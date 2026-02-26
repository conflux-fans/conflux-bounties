"""GitHub content ingestion pipeline."""
import os
import json
from typing import List, Dict, Any, Optional
from github import Github, GithubException
from pathlib import Path
import base64


class GitHubIngestionPipeline:
    def __init__(self, github_token: str):
        self.github = Github(github_token) if github_token else Github()
        self.supported_extensions = {'.md', '.mdx', '.txt'}
    
    def fetch_repo_contents(
        self,
        repo_name: str,
        path: str = "",
        branch: str = "main"
    ) -> List[Dict[str, Any]]:
        try:
            repo = self.github.get_repo(repo_name)
            contents = repo.get_contents(path, ref=branch)
            
            documents = []
            
            # Handle both file and directory responses
            if not isinstance(contents, list):
                contents = [contents]
            
            for content in contents:
                if content.type == "dir":
                    # Recursively fetch directory contents
                    subdir_docs = self.fetch_repo_contents(
                        repo_name,
                        content.path,
                        branch
                    )
                    documents.extend(subdir_docs)
                elif content.type == "file":
                    # Check if file extension is supported
                    file_ext = Path(content.path).suffix.lower()
                    if file_ext in self.supported_extensions:
                        try:
                            # Decode file content
                            file_content = base64.b64decode(content.content).decode('utf-8')
                            
                            documents.append({
                                "content": file_content,
                                "metadata": {
                                    "source": f"github:{repo_name}",
                                    "title": content.name,
                                    "path": content.path,
                                    "url": content.html_url,
                                    "branch": branch,
                                    "sha": content.sha,
                                    "size": content.size
                                }
                            })
                            print(f"Fetched: {content.path}")
                        except Exception as e:
                            print(f"Error decoding {content.path}: {e}")
            
            return documents
            
        except GithubException as e:
            print(f"GitHub API error: {e}")
            return []
    
    def fetch_multiple_repos(
        self,
        repo_configs: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        all_documents = []
        
        for config in repo_configs:
            repo_name = config.get("repo")
            path = config.get("path", "")
            branch = config.get("branch", "main")
            
            print(f"\nFetching from {repo_name} (branch: {branch}, path: {path})...")
            docs = self.fetch_repo_contents(repo_name, path, branch)
            all_documents.extend(docs)
            print(f"Fetched {len(docs)} documents from {repo_name}")
        
        return all_documents
    
    def fetch_file_raw(self, url: str) -> Optional[str]:
        import httpx
        
        # Convert regular GitHub URL to raw URL if needed
        if "github.com" in url and "/blob/" in url:
            url = url.replace("github.com", "raw.githubusercontent.com").replace("/blob/", "/")
        
        try:
            response = httpx.get(url, timeout=30.0)
            response.raise_for_status()
            return response.text
        except Exception as e:
            print(f"Error fetching {url}: {e}")
            return None
