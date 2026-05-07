#!/usr/bin/env python3
"""
locust_load_test.py

Production-ready Locust load test for SaaS launch readiness.
Simulates realistic user sessions: login -> browse -> API calls -> logout.

Usage:
    pip install locust
    locust -f locust_load_test.py --host https://your-app.com
    locust -f locust_load_test.py --host https://your-app.com --headless -u 50 -r 5 --run-time 5m

Environment variables:
    TEST_EMAIL     - Test user email (default: test@example.com)
    TEST_PASSWORD  - Test user password (default: testpassword)
"""

import os
import random
from locust import HttpUser, task, between, events


TEST_EMAIL = os.getenv("TEST_EMAIL", "test@example.com")
TEST_PASSWORD = os.getenv("TEST_PASSWORD", "testpassword")


class SaaSUser(HttpUser):
    """
    Simulates a typical SaaS user session.
    wait_time: between 1-5 seconds of "think time" between actions.
    """
    wait_time = between(1, 5)
    token = None

    def on_start(self):
        """Called when a simulated user starts. Perform login."""
        self.login()

    def on_stop(self):
        """Called when a simulated user stops. Perform logout."""
        if self.token:
            self.client.post(
                "/auth/v1/logout",
                headers={"Authorization": f"Bearer {self.token}"},
                name="auth_logout",
            )

    def login(self):
        """Authenticate and store JWT token."""
        response = self.client.post(
            "/auth/v1/token?grant_type=password",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
            name="auth_login",
        )
        if response.status_code == 200:
            data = response.json()
            self.token = data.get("access_token")
        else:
            self.token = None

    def _auth_headers(self):
        return {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    # Tasks

    @task(5)
    def view_calls_list(self):
        """Browse the main calls/transcripts list (most common action)."""
        if not self.token:
            self.login()
            return
        self.client.get(
            "/rest/v1/calls?order=created_at.desc&limit=20",
            headers=self._auth_headers(),
            name="api_calls_list",
        )

    @task(3)
    def search_calls(self):
        """Perform a search query."""
        if not self.token:
            return
        queries = ["sales", "demo", "onboarding", "support", "meeting"]
        q = random.choice(queries)
        self.client.get(
            f"/rest/v1/calls?title=ilike.*{q}*&limit=10",
            headers=self._auth_headers(),
            name="api_search",
        )

    @task(2)
    def view_call_detail(self):
        """Open a call detail view."""
        if not self.token:
            return
        # Get a list first, then open a random one
        resp = self.client.get(
            "/rest/v1/calls?order=created_at.desc&limit=5",
            headers=self._auth_headers(),
            name="api_calls_for_detail",
        )
        if resp.status_code == 200:
            calls = resp.json()
            if calls:
                call_id = random.choice(calls).get("id")
                if call_id:
                    self.client.get(
                        f"/rest/v1/calls?id=eq.{call_id}&select=*",
                        headers=self._auth_headers(),
                        name="api_call_detail",
                    )

    @task(1)
    def view_analytics(self):
        """Load the analytics endpoint."""
        if not self.token:
            return
        self.client.get(
            "/rest/v1/rpc/get_analytics_summary",
            headers=self._auth_headers(),
            name="api_analytics",
        )

    @task(1)
    def view_settings(self):
        """Access user settings."""
        if not self.token:
            return
        self.client.get(
            "/rest/v1/profiles?select=*",
            headers=self._auth_headers(),
            name="api_profile",
        )


class HeavyUser(SaaSUser):
    """
    Simulates a power user with higher activity and shorter think times.
    Use this to test peak load conditions.
    """
    wait_time = between(0.5, 2)

    @task(10)
    def view_calls_list(self):
        super().view_calls_list()

    @task(5)
    def search_calls(self):
        super().search_calls()


# Event hooks for reporting

@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    print(f"[Locust] Load test starting against: {environment.host}")
    print(f"[Locust] Test user: {TEST_EMAIL}")


@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    stats = environment.stats
    total = stats.total
    print("\n" + "=" * 60)
    print("[Locust] LOAD TEST RESULTS SUMMARY")
    print("=" * 60)
    print(f"Total requests:    {total.num_requests}")
    print(f"Failed requests:   {total.num_failures}")
    print(f"Error rate:        {total.fail_ratio * 100:.2f}%")
    print(f"Avg response time: {total.avg_response_time:.0f}ms")
    print(f"p95 response time: {total.get_response_time_percentile(0.95):.0f}ms")
    print(f"p99 response time: {total.get_response_time_percentile(0.99):.0f}ms")
    print(f"Requests/sec:      {total.current_rps:.1f}")
    print("=" * 60)

    # Launch gate assertions
    passed = True
    if total.fail_ratio > 0.01:
        print(f"FAIL: Error rate {total.fail_ratio*100:.2f}% exceeds 1% threshold")
        passed = False
    if total.get_response_time_percentile(0.95) > 2000:
        print(f"FAIL: p95 response time {total.get_response_time_percentile(0.95):.0f}ms exceeds 2000ms threshold")
        passed = False
    if passed:
        print("All launch gate thresholds PASSED")
