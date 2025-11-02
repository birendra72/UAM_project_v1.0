from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.dependencies.auth import get_current_user
from app.db.models import User
import httpx

router = APIRouter()

@router.get("/search")
async def search_stocks(query: str, current_user: User = Depends(get_current_user)):
    """
    Search for stocks using external API (e.g., Alpha Vantage or similar)
    """
    # For now, return mock data. In production, integrate with real stock API
    mock_stocks = [
        {"symbol": "AAPL", "name": "Apple Inc.", "price": 150.0},
        {"symbol": "GOOGL", "name": "Alphabet Inc.", "price": 2800.0},
        {"symbol": "MSFT", "name": "Microsoft Corporation", "price": 300.0},
    ]

    # Filter by query
    results = [stock for stock in mock_stocks if query.lower() in stock["symbol"].lower() or query.lower() in stock["name"].lower()]

    return {"stocks": results}
