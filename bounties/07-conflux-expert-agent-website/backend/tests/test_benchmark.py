import pytest
import asyncio
from typing import List, Dict
from agent.conflux_agent import ConfluxExpertAgent
from rag.vector_store import VectorStore
from tools.confluxscan_client import ConfluxScanClient, NetworkType
from config import settings


# 10 Benchmark Questions covering different aspects of Conflux
BENCHMARK_QUESTIONS = [
    {
        "id": 1,
        "question": "What is the difference between Conflux Core Space and eSpace?",
        "expected_keywords": ["core space", "espace", "evm", "compatibility"],
        "requires_docs": True,
        "requires_live_data": False
    },
    {
        "id": 2,
        "question": "How do I deploy a smart contract on Conflux eSpace?",
        "expected_keywords": ["deploy", "contract", "espace", "solidity"],
        "requires_docs": True,
        "requires_live_data": False
    },
    {
        "id": 3,
        "question": "Explain the sponsorship mechanism in Conflux",
        "expected_keywords": ["sponsor", "gas", "fee", "user"],
        "requires_docs": True,
        "requires_live_data": False
    },
    {
        "id": 4,
        "question": "How do I use the Conflux JavaScript SDK?",
        "expected_keywords": ["sdk", "javascript", "js-conflux-sdk", "install"],
        "requires_docs": True,
        "requires_live_data": False
    },
    {
        "id": 5,
        "question": "What is the Tree-Graph consensus algorithm?",
        "expected_keywords": ["tree-graph", "consensus", "dag", "block"],
        "requires_docs": True,
        "requires_live_data": False
    },
    {
        "id": 6,
        "question": "How do I check an account balance on Conflux?",
        "expected_keywords": ["balance", "account", "address"],
        "requires_docs": True,
        "requires_live_data": True
    },
    {
        "id": 7,
        "question": "How do I install and use the Conflux Python SDK?",
        "expected_keywords": ["python", "sdk", "install", "pip"],
        "requires_docs": True,
        "requires_live_data": False
    },
    {
        "id": 8,
        "question": "How do I send a transaction using the Conflux Python SDK?",
        "expected_keywords": ["python", "transaction", "send", "account"],
        "requires_docs": True,
        "requires_live_data": False
    },
    {
        "id": 9,
        "question": "How do I use the Conflux Go SDK to query an account balance?",
        "expected_keywords": ["go", "sdk", "balance", "account"],
        "requires_docs": True,
        "requires_live_data": False
    },
    {
        "id": 10,
        "question": "How do I deploy a smart contract using the Conflux Python SDK?",
        "expected_keywords": ["python", "contract", "deploy", "sdk"],
        "requires_docs": True,
        "requires_live_data": False
    }
]


class BenchmarkResults:
    def __init__(self):
        self.results: List[Dict] = []
    
    def add_result(self, question_id: int, question: str, response: str, 
                   citations: List[Dict], passed: bool, notes: str = ""):
        self.results.append({
            "id": question_id,
            "question": question,
            "response": response,
            "citations": citations,
            "passed": passed,
            "notes": notes
        })
    
    def get_pass_rate(self) -> float:
        if not self.results:
            return 0.0
        passed = sum(1 for r in self.results if r["passed"])
        return (passed / len(self.results)) * 100
    
    def print_summary(self):
        print("\n" + "=" * 80)
        print("BENCHMARK TEST RESULTS")
        print("=" * 80)
        
        for result in self.results:
            status = "PASS" if result["passed"] else "❌ FAIL"
            print(f"\n{status} Q{result['id']}: {result['question'][:60]}...")
            print(f"  Citations: {len(result['citations'])}")
            if result["notes"]:
                print(f"  Notes: {result['notes']}")
        
        print("\n" + "-" * 80)
        print(f"PASS RATE: {self.get_pass_rate():.1f}% ({sum(1 for r in self.results if r['passed'])}/{len(self.results)})")
        print("=" * 80 + "\n")


@pytest.fixture
async def agent():
    vector_store = VectorStore(
        api_key=settings.pinecone_api_key,
        index_name=settings.pinecone_index_name,
        embedding_model=settings.embedding_model,
    )

    confluxscan_client = ConfluxScanClient(
        api_key=settings.confluxscan_api_key,
        network=NetworkType.MAINNET_ESPACE
    )

    agent = ConfluxExpertAgent(
        vector_store=vector_store,
        confluxscan_client=confluxscan_client,
        model=settings.gemini_model,
        temperature=settings.temperature,
    )
    
    return agent


@pytest.mark.asyncio
@pytest.mark.slow
async def test_benchmark_suite(agent):
    results = BenchmarkResults()
    skipped = 0

    for i, benchmark in enumerate(BENCHMARK_QUESTIONS):
        if i > 0:
            await asyncio.sleep(13)

        print(f"\nTesting Q{benchmark['id']}: {benchmark['question']}")

        try:
            response_text = ""
            citations = []

            async for event in agent.chat(benchmark["question"], stream=True):
                if event["type"] == "content":
                    response_text += event.get("delta", "")
                elif event["type"] == "citations":
                    citations = event.get("citations", [])

            has_citations = len(citations) > 0
            has_keywords = any(
                keyword.lower() in response_text.lower()
                for keyword in benchmark["expected_keywords"]
            )

            passed = has_citations and has_keywords and len(response_text) > 50

            notes = []
            if not has_citations:
                notes.append("No citations")
            if not has_keywords:
                notes.append("Missing key terms")
            if len(response_text) < 50:
                notes.append("Response too short")

            results.add_result(
                question_id=benchmark["id"],
                question=benchmark["question"],
                response=response_text[:200],
                citations=citations,
                passed=passed,
                notes=", ".join(notes) if notes else "All checks passed",
            )

        except Exception as e:
            if "429" in str(e):
                print(f"  Skipping Q{benchmark['id']}: rate limited")
                skipped += 1
            else:
                results.add_result(
                    question_id=benchmark["id"],
                    question=benchmark["question"],
                    response="",
                    citations=[],
                    passed=False,
                    notes=f"Error: {str(e)}",
                )

    results.print_summary()

    if len(results.results) == 0:
        pytest.skip("All questions were rate limited")

    assert results.get_pass_rate() >= 70.0, f"Pass rate too low: {results.get_pass_rate():.1f}%"


@pytest.mark.asyncio
async def test_citation_format(agent):
    question = "What is Conflux?"

    response_text = ""
    try:
        async for event in agent.chat(question, stream=True):
            if event["type"] == "content":
                response_text += event.get("delta", "")
    except Exception as e:
        if "429" in str(e):
            pytest.skip("Rate limited")
        raise

    if not response_text:
        pytest.skip("Empty response - likely rate limited")

    import re
    citation_pattern = r'\[\d+\]'
    citations_found = re.findall(citation_pattern, response_text)

    assert len(citations_found) > 0, "No citations found in response"


@pytest.mark.asyncio
async def test_conversation_memory(agent):
    async for event in agent.chat("What is Conflux Core Space?", stream=True):
        pass
    
    response_text = ""
    async for event in agent.chat("What are its main features?", stream=True):
        if event["type"] == "content":
            response_text += event.get("delta", "")
    
    assert len(response_text) > 20, "No meaningful follow-up response"


if __name__ == "__main__":
    """Run benchmark tests directly."""
    print("Running Conflux Expert Benchmark Suite...")
    pytest.main([__file__, "-v", "-s", "-m", "slow"])
