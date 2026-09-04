"""Unit tests for SlidingWindowRateLimiter enforcing burst and daily quotas."""

import time
import unittest
try:
    from rag.rate_limiter import SlidingWindowRateLimiter
except ModuleNotFoundError:
    from backend.rag.rate_limiter import SlidingWindowRateLimiter


class RateLimiterTests(unittest.TestCase):
    def setUp(self):
        self.limiter = SlidingWindowRateLimiter(max_burst=5, burst_window_seconds=60, max_daily=25)

    def test_burst_limit_five_queries_per_minute(self):
        client = "guest_ip_1"
        # 5 queries within 60 seconds should be allowed
        for i in range(5):
            status = self.limiter.check_and_record(client, daily_limit=25, burst_limit=5)
            self.assertTrue(status.allowed, f"Request {i+1} should be allowed")
            self.assertEqual(status.burst_remaining, 4 - i)

        # 6th query within same minute should be rejected
        status_blocked = self.limiter.check_and_record(client, daily_limit=25, burst_limit=5)
        self.assertFalse(status_blocked.allowed)
        self.assertIn("Burst limit exceeded (5 requests/min)", status_blocked.reason)
        self.assertGreater(status_blocked.retry_after_seconds, 0)
        self.assertEqual(status_blocked.burst_remaining, 0)

    def test_unsigned_daily_limit_twenty_five(self):
        client = "guest_ip_2"
        now = time.time()
        # Seed 25 requests spaced across the day (older than 60s ago to avoid burst limit)
        self.limiter._requests[client] = [now - 3600 + i * 10 for i in range(25)]

        # 26th request should exceed the unsigned daily quota of 25
        status = self.limiter.check_and_record(client, daily_limit=25, burst_limit=5)
        self.assertFalse(status.allowed)
        self.assertIn("Daily limit reached (25 queries / day)", status.reason)
        self.assertEqual(status.daily_remaining, 0)

    def test_signed_in_daily_limit_fifty(self):
        user_client = "user_42"
        now = time.time()
        # Seed 49 requests spaced across the day
        self.limiter._requests[user_client] = [now - 3600 + i * 10 for i in range(49)]

        # 50th request should still be allowed
        status_50 = self.limiter.check_and_record(user_client, daily_limit=50, burst_limit=5)
        self.assertTrue(status_50.allowed)
        self.assertEqual(status_50.daily_remaining, 0)

        # 51st request should be blocked
        status_51 = self.limiter.check_and_record(user_client, daily_limit=50, burst_limit=5)
        self.assertFalse(status_51.allowed)
        self.assertIn("Daily limit reached (50 queries / day)", status_51.reason)
        self.assertEqual(status_51.daily_remaining, 0)

    def test_authenticated_requests_do_not_pollute_unsigned_quota(self):
        guest_client = "guest_ip_3"
        user_client = "user_99"

        # User queries with 50 limit
        for _ in range(5):
            self.limiter.check_and_record(user_client, daily_limit=50, burst_limit=5)

        # Guest client should still have default 25 daily quota unaffected
        status_guest = self.limiter.check_and_record(guest_client, daily_limit=25, burst_limit=5)
        self.assertTrue(status_guest.allowed)
        self.assertEqual(status_guest.daily_remaining, 24)

    def test_faq_query_exemption(self):
        client = "guest_ip_4"
        # Seed 25 requests so daily quota is exhausted
        now = time.time()
        self.limiter._requests[client] = [now - 3600 + i * 10 for i in range(25)]

        # FAQ query should bypass quota and succeed
        status_faq = self.limiter.check_and_record(client, is_faq_query=True, daily_limit=25, burst_limit=5)
        self.assertTrue(status_faq.allowed)


if __name__ == "__main__":
    unittest.main()
