import os
from dotenv import load_dotenv
import praw

load_dotenv()

reddit = praw.Reddit(
    client_id=os.getenv("REDDIT_CLIENT_ID"),
    client_secret=os.getenv("REDDIT_CLIENT_SECRET"),
    user_agent=os.getenv("REDDIT_USER_AGENT"),
)

def search_reddit(query: str, subreddit: str = "all", limit: int = 10):
    results = []

    for post in reddit.subreddit(subreddit).search(
        query,
        sort="relevance",
        time_filter="year",
        limit=limit,
    ):
        results.append({
            "title": post.title,
            "subreddit": str(post.subreddit),
            "score": post.score,
            "num_comments": post.num_comments,
            "url": f"https://reddit.com{post.permalink}",
            "text": post.selftext[:500] if post.selftext else "",
        })

    return results


if __name__ == "__main__":
    query = "best ramen in Portland Oregon"
    posts = search_reddit(query, subreddit="all", limit=5)

    for i, post in enumerate(posts, start=1):
        print(f"\n{i}. {post['title']}")
        print(f"r/{post['subreddit']} | score: {post['score']} | comments: {post['num_comments']}")
        print(post["url"])
        print(post["text"])