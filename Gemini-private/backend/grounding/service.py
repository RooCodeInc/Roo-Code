"""
Web Grounding Service
Provides real-time web search capabilities for AI responses
"""
import logging
from typing import List, Dict, Any
import httpx
from backend.shared.config import settings

logger = logging.getLogger(__name__)


class WebGroundingService:
    """Service for web search and grounding"""

    def __init__(self):
        self.api_key = settings.GOOGLE_SEARCH_API_KEY
        self.search_engine_id = settings.GOOGLE_SEARCH_ENGINE_ID
        self.base_url = "https://www.googleapis.com/customsearch/v1"

    async def search(
        self,
        query: str,
        num_results: int = 5,
        date_restrict: str = None
    ) -> List[Dict[str, Any]]:
        """
        Perform web search using Google Custom Search API
        """
        if not self.api_key or not self.search_engine_id:
            logger.warning("Google Search API not configured")
            return []

        params = {
            "key": self.api_key,
            "cx": self.search_engine_id,
            "q": query,
            "num": min(num_results, 10)  # Google allows max 10 per request
        }

        if date_restrict:
            params["dateRestrict"] = date_restrict

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(self.base_url, params=params, timeout=10.0)
                response.raise_for_status()
                data = response.json()

                results = []
                for item in data.get("items", []):
                    results.append({
                        "title": item.get("title"),
                        "link": item.get("link"),
                        "snippet": item.get("snippet"),
                        "displayLink": item.get("displayLink")
                    })

                return results

        except httpx.HTTPError as e:
            logger.error(f"Web search failed: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error during web search: {e}")
            return []

    async def get_grounding_context(
        self,
        query: str,
        num_results: int = 3
    ) -> str:
        """
        Get web search results formatted as context for AI
        """
        results = await self.search(query, num_results)

        if not results:
            return ""

        # Format results for AI context
        context_parts = [f"Web search results for '{query}':\n"]

        for idx, result in enumerate(results, 1):
            context_parts.append(
                f"{idx}. {result['title']}\n"
                f"   URL: {result['link']}\n"
                f"   {result['snippet']}\n"
            )

        return "\n".join(context_parts)

    async def fetch_page_content(self, url: str, max_length: int = 5000) -> str:
        """
        Fetch and extract text content from a web page
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    url,
                    timeout=10.0,
                    follow_redirects=True,
                    headers={"User-Agent": "AI-Chat-Platform/1.0"}
                )
                response.raise_for_status()

                # Simple text extraction (in production, use beautifulsoup4 or trafilatura)
                content = response.text

                # Remove HTML tags (basic approach)
                import re
                text = re.sub(r'<[^>]+>', '', content)
                text = re.sub(r'\s+', ' ', text).strip()

                return text[:max_length]

        except Exception as e:
            logger.error(f"Failed to fetch page content from {url}: {e}")
            return ""
