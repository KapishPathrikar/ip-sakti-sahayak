"""Rate limiting utilities implementing sliding-window burst and daily quotas."""

from __future__ import annotations

import time
import datetime
from collections import defaultdict
from typing import NamedTuple


class RateLimitStatus(NamedTuple):
	allowed: bool
	reason: str | None = None
	retry_after_seconds: int = 0
	daily_remaining: int = 25
	burst_remaining: int = 5


class SlidingWindowRateLimiter:
	"""
	In-memory rate limiter.
	- Burst limit: max_burst queries per burst_window_seconds (default: 5 queries / 60s)
	- Daily quota: max_daily queries per calendar day (UTC)
	"""

	def __init__(
		self,
		max_burst: int = 5,
		burst_window_seconds: int = 60,
		max_daily: int = 25,
		daily_window_seconds: int = 86400, # Kept for backward compatibility if needed elsewhere
	):
		self.max_burst = max_burst
		self.burst_window_seconds = burst_window_seconds
		self.max_daily = max_daily
		self.daily_window_seconds = daily_window_seconds
		# Store timestamps of requests per client key (IP / Session)
		self._requests: dict[str, list[float]] = defaultdict(list)

	def check_and_record(
		self,
		client_id: str,
		is_faq_query: bool = False,
		daily_limit: int | None = None,
		burst_limit: int | None = None,
	) -> RateLimitStatus:
		"""
		Check if request is allowed and record it if allowed.
		FAQ cache queries are exempt from quotas.
		Supports per-request daily_limit and burst_limit without mutating global state.
		"""
		effective_daily = daily_limit if daily_limit is not None else self.max_daily
		effective_burst = burst_limit if burst_limit is not None else self.max_burst

		now = time.time()
		now_utc = datetime.datetime.now(datetime.timezone.utc)
		start_of_day = datetime.datetime(now_utc.year, now_utc.month, now_utc.day, tzinfo=datetime.timezone.utc)
		cutoff_daily = start_of_day.timestamp()

		timestamps = self._requests[client_id]

		# 1. Prune timestamps older than 12:00 AM UTC today
		valid_timestamps = [t for t in timestamps if t >= cutoff_daily]
		self._requests[client_id] = valid_timestamps

		# If it's a pre-verified FAQ query, always allow with zero quota deduction
		if is_faq_query:
			return RateLimitStatus(
				allowed=True,
				daily_remaining=max(0, effective_daily - len(valid_timestamps)),
				burst_remaining=effective_burst,
			)

		# 2. Check Burst Limit (last 60 seconds)
		cutoff_burst = now - self.burst_window_seconds
		burst_requests = [t for t in valid_timestamps if t > cutoff_burst]
		if len(burst_requests) >= effective_burst:
			oldest_burst = min(burst_requests)
			retry_after = max(1, int(self.burst_window_seconds - (now - oldest_burst)))
			return RateLimitStatus(
				allowed=False,
				reason=f"Burst limit exceeded ({effective_burst} requests/min). Please wait {retry_after}s.",
				retry_after_seconds=retry_after,
				daily_remaining=max(0, effective_daily - len(valid_timestamps)),
				burst_remaining=0,
			)

		# 3. Check Daily Quota (calendar day)
		if len(valid_timestamps) >= effective_daily:
			# Time until next midnight UTC
			next_midnight = start_of_day + datetime.timedelta(days=1)
			retry_after = max(1, int(next_midnight.timestamp() - now))
			hours = retry_after // 3600
			minutes = (retry_after % 3600) // 60
			return RateLimitStatus(
				allowed=False,
				reason=f"Daily limit reached ({effective_daily} queries / day). Resets in {hours}h {minutes}m.",
				retry_after_seconds=retry_after,
				daily_remaining=0,
				burst_remaining=max(0, effective_burst - len(burst_requests)),
			)

		# 4. Request is permitted: record current timestamp
		valid_timestamps.append(now)
		daily_remaining = max(0, effective_daily - len(valid_timestamps))
		burst_remaining = max(0, effective_burst - (len(burst_requests) + 1))

		return RateLimitStatus(
			allowed=True,
			daily_remaining=daily_remaining,
			burst_remaining=burst_remaining,
		)

	def reset_client(self, client_id: str) -> None:
		"""Reset tracking for a specific client (useful for unit tests/admins)."""
		if client_id in self._requests:
			del self._requests[client_id]


# Global singleton instance
rate_limiter = SlidingWindowRateLimiter()
