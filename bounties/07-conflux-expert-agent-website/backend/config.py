"""Configuration management for the Conflux Expert backend."""

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    gemini_api_key: str = Field(..., alias="GEMINI_API_KEY")
    gemini_model: str = Field(default="gemini-2.5-flash", alias="GEMINI_MODEL")

    # Embeddings (Pinecone integrated)
    embedding_model: str = Field(default="llama-text-embed-v2", alias="EMBEDDING_MODEL")
    embedding_dimension: int = Field(default=1024, alias="EMBEDDING_DIMENSION")

    # Pinecone
    pinecone_api_key: str = Field(..., alias="VECTOR_DB_API")
    pinecone_environment: str = Field(default="us-east-1", alias="PINECONE_ENVIRONMENT")
    pinecone_index_name: str = Field(default="conflux-expert", alias="PINECONE_INDEX")

    # ConfluxScan
    confluxscan_api_key: str = Field(default="", alias="CONFLUXSCAN_API_KEY")

    # GitHub
    github_token: str = Field(default="", alias="GITHUB_TOKEN")

    # RAG Settings
    chunk_size: int = Field(default=1000, alias="CHUNK_SIZE")
    chunk_overlap: int = Field(default=200, alias="CHUNK_OVERLAP")
    top_k_results: int = Field(default=5, alias="TOP_K_RESULTS")

    # Agent Settings
    max_conversation_memory: int = Field(default=10, alias="MAX_CONVERSATION_MEMORY")
    temperature: float = Field(default=0.7, alias="TEMPERATURE")
    admin_password: str = Field(default="changeme", alias="ADMIN_PASSWORD")
    jwt_secret: str = Field(default="changeme", alias="JWT_SECRET")
    mcp_server_url: str = Field(default="http://localhost:5004", alias="MCP_SERVER_URL")

    class Config:
        env_file = ".env"
        case_sensitive = False


# Global settings instance
settings = Settings()
