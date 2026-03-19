"""Text processing utilities for RAG pipeline."""
from typing import List, Dict, Any
import re
from markdown import markdown
from bs4 import BeautifulSoup
from slugify import slugify


class TextProcessor:
    def __init__(self, chunk_size: int = 1000, chunk_overlap: int = 200):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
    
    def clean_markdown(self, text: str) -> str:
        # Remove HTML comments
        text = re.sub(r'<!--.*?-->', '', text, flags=re.DOTALL)
        
        # Remove excessive whitespace
        text = re.sub(r'\n\s*\n\s*\n+', '\n\n', text)
        
        # Remove leading/trailing whitespace
        text = text.strip()
        
        return text
    
    def markdown_to_text(self, markdown_text: str) -> str:
        # Convert to HTML
        html = markdown(markdown_text)
        
        # Parse HTML and extract text
        soup = BeautifulSoup(html, 'html.parser')
        text = soup.get_text(separator=' ', strip=True)
        
        return text
    
    def chunk_text(
        self,
        text: str,
        metadata: Dict[str, Any] = None
    ) -> List[Dict[str, Any]]:
        if not text or len(text.strip()) == 0:
            return []
        
        # Split by paragraphs first
        paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]
        
        chunks = []
        current_chunk = ""
        current_size = 0
        
        for para in paragraphs:
            para_size = len(para)
            
            # If single paragraph is too large, split it
            if para_size > self.chunk_size:
                # Save current chunk if exists
                if current_chunk:
                    chunks.append(current_chunk.strip())
                    current_chunk = ""
                    current_size = 0
                
                # Split large paragraph by sentences
                sentences = re.split(r'[.!?]\s+', para)
                for sentence in sentences:
                    if current_size + len(sentence) > self.chunk_size:
                        if current_chunk:
                            chunks.append(current_chunk.strip())
                        current_chunk = sentence
                        current_size = len(sentence)
                    else:
                        current_chunk += " " + sentence
                        current_size += len(sentence)
            else:
                # Check if adding this paragraph exceeds chunk size
                if current_size + para_size > self.chunk_size:
                    # Save current chunk
                    chunks.append(current_chunk.strip())
                    # Start new chunk with overlap
                    if self.chunk_overlap > 0:
                        overlap_text = current_chunk[-self.chunk_overlap:]
                        current_chunk = overlap_text + "\n\n" + para
                        current_size = len(current_chunk)
                    else:
                        current_chunk = para
                        current_size = para_size
                else:
                    # Add to current chunk
                    if current_chunk:
                        current_chunk += "\n\n" + para
                    else:
                        current_chunk = para
                    current_size += para_size
        
        # Don't forget the last chunk
        if current_chunk:
            chunks.append(current_chunk.strip())
        
        # Create chunk documents with metadata
        chunk_docs = []
        base_metadata = metadata or {}
        
        for i, chunk_text in enumerate(chunks):
            chunk_id = f"{base_metadata.get('source', 'unknown')}_{i}"
            chunk_id = slugify(chunk_id)
            
            chunk_docs.append({
                "id": chunk_id,
                "text": chunk_text,
                "metadata": {
                    **base_metadata,
                    "chunk_index": i,
                    "total_chunks": len(chunks)
                }
            })
        
        return chunk_docs
    
    def extract_code_blocks(self, markdown_text: str) -> List[Dict[str, str]]:
        """Extract code blocks from markdown.
        
        Args:
            markdown_text: Markdown content
            
        Returns:
            List of code blocks with language and content
        """
        pattern = r'```(\w+)?\n(.*?)```'
        matches = re.findall(pattern, markdown_text, re.DOTALL)
        
        code_blocks = []
        for lang, code in matches:
            code_blocks.append({
                "language": lang or "text",
                "code": code.strip()
            })
        
        return code_blocks
    
    def process_document(
        self,
        content: str,
        source: str,
        title: str,
        url: str,
        doc_type: str = "markdown",
        additional_metadata: Dict[str, Any] = None
    ) -> List[Dict[str, Any]]:
        # Clean content
        if doc_type == "markdown":
            content = self.clean_markdown(content)
        
        # Prepare base metadata
        metadata = {
            "source": source,
            "title": title,
            "url": url,
            "type": doc_type,
            **(additional_metadata or {})
        }
        
        # Chunk the content
        chunks = self.chunk_text(content, metadata)
        
        return chunks
