import pytest
from unittest.mock import Mock, patch, MagicMock
from ingestion.github_ingest import GitHubIngestionPipeline
from rag.text_processor import TextProcessor


def test_text_processor_clean_markdown():
    processor = TextProcessor()

    markdown = """# Title

Some text here.

```python
def hello():
    pass
```

More text."""

    result = processor.markdown_to_text(markdown)

    assert "```python" not in result
    assert "Some text here" in result
    assert "More text" in result

    
def test_text_processor_chunk_text():
    processor = TextProcessor(chunk_size=100, chunk_overlap=20)

    long_text = "\n\n".join(["word " * 30 for _ in range(8)])

    chunks = processor.chunk_text(long_text)

    assert len(chunks) > 1
    for chunk in chunks:
        assert len(chunk["text"].split()) <= 150


def test_text_processor_extract_metadata():
    processor = TextProcessor()

    chunks = processor.process_document(
        content="Introduction\n\nContent here.",
        source="test",
        title="Conflux Documentation",
        url="https://example.com",
        additional_metadata={"description": "Official docs"},
    )

    assert len(chunks) > 0
    assert chunks[0]["metadata"]["title"] == "Conflux Documentation"
    assert chunks[0]["metadata"]["description"] == "Official docs"


@pytest.mark.asyncio
async def test_github_ingestor_init():
    ingestor = GitHubIngestionPipeline(github_token="test_token")

    assert ingestor.github is not None


def test_github_ingestor_fetch_repo_files():
    import base64
    with patch('ingestion.github_ingest.Github') as mock_github:
        mock_file = Mock(
            type="file",
            path="README.md",
            name="README.md",
            html_url="https://github.com/Conflux-Chain/conflux-doc/blob/main/README.md",
            sha="abc123",
            size=17,
            content=base64.b64encode(b"# README\nContent").decode(),
        )
        mock_repo = Mock()
        mock_repo.get_contents.return_value = [mock_file]
        mock_github.return_value.get_repo.return_value = mock_repo

        ingestor = GitHubIngestionPipeline(github_token="test_token")
        files = ingestor.fetch_repo_contents(
            repo_name="Conflux-Chain/conflux-doc",
            branch="main",
        )

        assert len(files) == 1
        assert files[0]["metadata"]["path"] == "README.md"


def test_chunk_metadata_preservation():
    processor = TextProcessor(chunk_size=100)

    text = "\n\n".join(["content " * 20 for _ in range(5)])
    metadata = {
        "title": "Test Doc",
        "url": "https://example.com/doc",
        "source": "github",
    }

    chunks = processor.chunk_text(text, metadata)

    for chunk in chunks:
        assert chunk["metadata"]["title"] == "Test Doc"
        assert chunk["metadata"]["url"] == "https://example.com/doc"
        assert chunk["metadata"]["source"] == "github"
        assert "text" in chunk
