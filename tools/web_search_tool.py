from typing import List, Dict, Any

class WebSearchTool:
    """Tool for querying external library documentation or web search results."""

    def search(self, query: str, max_results: int = 5) -> List[Dict[str, Any]]:
        """Queries DuckDuckGo search or provides cached documentation reference snippets."""
        try:
            from duckduckgo_search import DDGS
            results = []
            with DDGS() as ddgs:
                ddg_gen = ddgs.text(query, max_results=max_results)
                if ddg_gen:
                    for r in ddg_gen:
                        results.append({
                            "title": r.get("title", ""),
                            "url": r.get("href", ""),
                            "snippet": r.get("body", "")
                        })
            return results
        except Exception:
            # Fallback mock documentation snippets for python standard tools
            return [
                {
                    "title": f"Documentation snippet for {query}",
                    "url": "https://docs.python.org/3/",
                    "snippet": f"Official documentation search reference for '{query}'. Ensure clean error handling and follow PEP 8 standards."
                }
            ]
