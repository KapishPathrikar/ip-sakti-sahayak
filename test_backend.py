#!/usr/bin/env python3
"""
Test script for IP Shakti Sahayak backend.
Use this to test API endpoints with Postman or directly.
"""

import requests
import json
import sys

BASE_URL = "http://localhost:8000"

def test_health():
    """Test health endpoint."""
    print("🔍 Testing Health Endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        print(f"✅ Status: {response.status_code}")
        print(f"✅ Response: {response.json()}")
        return True
    except Exception as e:
        print(f"❌ Health check failed: {e}")
        return False

def test_faqs():
    """Test FAQ endpoint."""
    print("\n📚 Testing FAQ Endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/api/faqs", timeout=5)
        print(f"✅ Status: {response.status_code}")
        data = response.json()
        print(f"✅ Found {data['count']} FAQs")
        print(f"✅ First FAQ: {data['faqs'][0]['question'][:50]}...")
        return True
    except Exception as e:
        print(f"❌ FAQ test failed: {e}")
        return False

def test_ask_faq():
    """Test asking a FAQ question (works without Ollama)."""
    print("\n💬 Testing FAQ Question (Instant Answer)...")
    payload = {
        "query": "What is TKDL?",
        "limit": 4
    }

    try:
        response = requests.post(
            f"{BASE_URL}/api/ask",
            json=payload,
            timeout=10
        )
        print(f"✅ Status: {response.status_code}")
        data = response.json()
        print(f"✅ Answer: {data['answer'][:100]}...")
        print(f"✅ Grounded: {data['grounded']}")
        print(f"✅ Citations: {len(data['citations'])}")
        return True
    except Exception as e:
        print(f"❌ Ask test failed: {e}")
        return False

def test_ask_rag():
    """Test RAG question (may need Ollama/Cloud LLM)."""
    print("\n🧠 Testing RAG Question (Needs LLM)...")
    payload = {
        "query": "How to patent an Ayurvedic formulation in India?",
        "limit": 4,
        "model": "llama3.2:3b"
    }

    try:
        response = requests.post(
            f"{BASE_URL}/api/ask",
            json=payload,
            timeout=30
        )
        print(f"✅ Status: {response.status_code}")
        data = response.json()
        print(f"✅ Answer: {data['answer'][:150]}...")
        print(f"✅ Grounded: {data['grounded']}")
        print(f"✅ Citations: {len(data['citations'])}")
        return True
    except requests.exceptions.Timeout:
        print("⚠️  Request timed out. This may mean:")
        print("   1. Ollama is not installed/running")
        print("   2. Cloud LLM API key is not configured")
        print("   3. The model is loading (if using Ollama)")
        return False
    except Exception as e:
        print(f"❌ RAG test failed: {e}")
        return False

def test_streaming():
    """Test streaming endpoint."""
    print("\n🌀 Testing Streaming Endpoint...")
    payload = {
        "query": "Explain patent law in India",
        "limit": 4
    }

    try:
        response = requests.post(
            f"{BASE_URL}/api/chat/stream",
            json=payload,
            stream=True,
            timeout=10
        )

        print(f"✅ Status: {response.status_code}")
        print("✅ Streaming response (first 3 chunks):")

        chunk_count = 0
        for line in response.iter_lines():
            if line:
                chunk_count += 1
                if chunk_count <= 3:
                    print(f"   Chunk {chunk_count}: {line.decode('utf-8')[:50]}...")
                if chunk_count >= 3:
                    break

        if chunk_count > 0:
            print(f"✅ Received {chunk_count} chunks")
            return True
        else:
            print("⚠️  No stream data received")
            return False

    except Exception as e:
        print(f"❌ Streaming test failed: {e}")
        return False

def generate_postman_collection():
    """Generate Postman collection JSON for easy import."""
    print("\n📱 Generating Postman Collection...")

    collection = {
        "info": {
            "name": "IP Shakti Sahayak API",
            "description": "RAG backend for Indian IP law assistance",
            "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
        },
        "item": [
            {
                "name": "Health Check",
                "request": {
                    "method": "GET",
                    "header": [],
                    "url": {
                        "raw": "{{base_url}}/health",
                        "host": ["{{base_url}}"],
                        "path": ["health"]
                    }
                }
            },
            {
                "name": "List FAQs",
                "request": {
                    "method": "GET",
                    "header": [],
                    "url": {
                        "raw": "{{base_url}}/api/faqs",
                        "host": ["{{base_url}}"],
                        "path": ["api", "faqs"]
                    }
                }
            },
            {
                "name": "Ask Question (FAQ)",
                "request": {
                    "method": "POST",
                    "header": [
                        {
                            "key": "Content-Type",
                            "value": "application/json"
                        }
                    ],
                    "body": {
                        "mode": "raw",
                        "raw": json.dumps({
                            "query": "What is Intellectual Property?",
                            "limit": 4
                        }, indent=2)
                    },
                    "url": {
                        "raw": "{{base_url}}/api/ask",
                        "host": ["{{base_url}}"],
                        "path": ["api", "ask"]
                    }
                }
            },
            {
                "name": "Ask Question (RAG)",
                "request": {
                    "method": "POST",
                    "header": [
                        {
                            "key": "Content-Type",
                            "value": "application/json"
                        }
                    ],
                    "body": {
                        "mode": "raw",
                        "raw": json.dumps({
                            "query": "How to file a patent in India?",
                            "limit": 4,
                            "model": "llama3.2:3b"
                        }, indent=2)
                    },
                    "url": {
                        "raw": "{{base_url}}/api/ask",
                        "host": ["{{base_url}}"],
                        "path": ["api", "ask"]
                    }
                }
            },
            {
                "name": "Streaming Chat",
                "request": {
                    "method": "POST",
                    "header": [
                        {
                            "key": "Content-Type",
                            "value": "application/json"
                        }
                    ],
                    "body": {
                        "mode": "raw",
                        "raw": json.dumps({
                            "query": "Explain trademark registration",
                            "limit": 4
                        }, indent=2)
                    },
                    "url": {
                        "raw": "{{base_url}}/api/chat/stream",
                        "host": ["{{base_url}}"],
                        "path": ["api", "chat", "stream"]
                    }
                }
            }
        ],
        "variable": [
            {
                "key": "base_url",
                "value": "http://localhost:8000"
            }
        ]
    }

    # Save to file
    with open("postman_collection.json", "w") as f:
        json.dump(collection, f, indent=2)

    print("✅ Postman collection saved to 'postman_collection.json'")
    print("📥 Import this file into Postman for easy testing")
    return True

def main():
    """Run all tests."""
    print("=" * 60)
    print("IP SHAKTI SAHAYAK - BACKEND TEST SUITE")
    print("=" * 60)

    # Check if server is running
    if not test_health():
        print("\n❌ Server not running. Please start the backend:")
        print("   source .venv/Scripts/activate")
        print("   uvicorn backend.main:app --reload --port 8000")
        return

    # Run tests
    tests = [
        ("Health Check", test_health),
        ("FAQ List", test_faqs),
        ("FAQ Question", test_ask_faq),
        ("RAG Question", test_ask_rag),
        ("Streaming", test_streaming),
        ("Postman Collection", generate_postman_collection)
    ]

    results = []
    for test_name, test_func in tests:
        try:
            success = test_func()
            results.append((test_name, success))
        except Exception as e:
            print(f"❌ {test_name} crashed: {e}")
            results.append((test_name, False))

    # Print summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)

    for test_name, success in results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")

    passed = sum(1 for _, success in results if success)
    total = len(results)

    print(f"\n🎯 Result: {passed}/{total} tests passed")

    # Recommendations
    print("\n" + "=" * 60)
    print("NEXT STEPS")
    print("=" * 60)

    if not any(success for _, success in results[3:5]):  # RAG and Streaming tests
        print("\n⚠️  RAG/Streaming tests failed. You need to:")
        print("   1. INSTALL OLLAMA (Recommended):")
        print("      - Download: https://ollama.com/download/windows")
        print("      - Install and run: ollama run llama3.2:3b")
        print("\n   2. OR Configure Cloud API (Free):")
        print("      - Get free API key from Together.ai: https://www.together.ai/")
        print("      - Add to backend/.env: TOGETHER_API_KEY=your_key")
        print("\n   3. OR Test FAQ only (Works now!):")
        print("      - FAQ questions work without any LLM")
        print("      - Try: What is TKDL? What is Intellectual Property?")

    print("\n📱 For Postman testing:")
    print("   - Use generated 'postman_collection.json'")
    print("   - Import into Postman")
    print("   - Test all endpoints")

    print("\n🔧 For development:")
    print("   - FAQ system works 100% without Ollama")
    print("   - Your frontend can connect to http://localhost:8000")
    print("   - API docs: http://localhost:8000/docs")

if __name__ == "__main__":
    main()