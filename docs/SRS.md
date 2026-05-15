# Software Requirements Specification
## Minception — API Mock Gateway Platform

**Version:** 1.0  
**Date:** 2026-05-15  
**Owner:** Wajih Aslam (wajih.aslam@gmail.com)  
**Repo:** github.com/wajihaslam/minception  

---

## 1. Benefit Hypothesis

Development teams waste significant time waiting on real backend APIs that are either incomplete, unstable, or behind a paywall in early project stages. This blocks frontend development, QA testing, and integration work — slowing delivery and increasing costs.

**Minception solves this by:**

| Problem | Benefit |
|---------|---------|
| Frontend blocked by unfinished backend | Teams can develop against realistic mock APIs from day one |
| QA can't test edge cases on real APIs | Any response scenario (errors, timeouts, edge cases) can be configured on demand |
| Teams hardcode fake responses in source code | Mocks are managed centrally via a dashboard — no code changes needed |
| Different environments need different behaviors | Conditional responses ("flavors") match on headers, body, or query params |
| Onboarding new developers is slow | One Docker command spins up the entire mock environment locally |

**Hypothesis:** If development and QA teams can configure realistic, conditional mock APIs without writing code, they will ship features faster, find bugs earlier, and reduce backend dependency bottlenecks by at least 40%.

---

## 2. Product Description

Minception is an **API Mock Gateway platform** that allows teams to define mock HTTP endpoints with conditional responses called **Flavors**. It is deployed as a self-hosted web application consisting of three services behind an nginx reverse proxy.

### How It Works

```
Developer configures a Gateway (base path) →
  Adds Endpoints (method + path) →
    Adds Flavors (conditions + response) →
      Any HTTP client hitting /mock/* gets the matching response
```

### Who It's For

| User | Role |
|------|------|
| Frontend Developers | Develop UI features without waiting for real APIs |
| QA Engineers | Simulate error states, timeouts, and edge case responses |
| Backend Developers | Provide a contract/stub while building the real API |
| Team Leads | Manage team access, monitor request logs, configure gateways |

### Deployment

- Self-hosted via Docker Compose
- Three environments: Local, Staging, Production
- Single shared MongoDB Atlas database per environment
- Accessible via web browser — no CLI knowledge required for day-to-day use

---

## 3. Use Cases

### UC-01: Frontend team develops without a real backend
A frontend team is building a checkout flow. The backend payment API is still being developed. They configure a mock `/api/v1/payments/charge` endpoint in Minception with two flavors: one returning a success response for valid card numbers, and one returning a declined response for test card numbers. The frontend team develops and tests the complete flow without any backend dependency.

### UC-02: QA engineer tests error handling
A QA engineer needs to verify the app handles a 503 Service Unavailable response gracefully. They add a flavor to an existing endpoint that returns 503 when a specific header `X-Force-Error: 503` is present. They run their test suite against the mock — no backend changes required.

### UC-03: Backend developer provides an API contract
A backend developer is building a new `/users/profile` endpoint. Before the implementation is ready, they configure it in Minception with the agreed response shape. The frontend team can start integration immediately while the real API is being built in parallel.

### UC-04: Team lead monitors API usage
A team lead wants to understand which mock endpoints are being hit most frequently and whether any requests are failing to match a flavor. They open the Logs page in the admin dashboard, filter by gateway, and review matched flavors and request payloads.

### UC-05: Admin onboards a new team member
A new developer joins the team. The admin creates a new user account with `editor` role. The new developer logs in, browses existing gateways, and starts adding flavors to endpoints — without access to delete gateways or manage other users.

### UC-06: Team configures environment-specific responses
The staging environment needs to return slower responses to simulate real-world latency. A developer sets `delay_ms: 1500` on the staging flavor while keeping the local flavor at `delay_ms: 0`. Both environments point to the same gateway configuration but serve different flavors based on request conditions.

---

## 4. Features

### 4.1 Gateway Management
The top-level grouping of mock API configurations.

- Create a gateway with a name, base path (e.g. `/api/v1`), and description
- Edit gateway name, base path, and description
- Activate / deactivate a gateway (deactivated gateways return 404 on all requests)
- Delete a gateway and all its endpoints and flavors
- List all gateways with status and endpoint count

---

### 4.2 Endpoint Management
Define which HTTP routes exist within a gateway.

- Add an endpoint with HTTP method (GET, POST, PUT, PATCH, DELETE) and path (e.g. `/users/create`)
- Edit endpoint path, method, and description
- Activate / deactivate individual endpoints
- Delete an endpoint and all its flavors
- List all endpoints within a gateway

---

### 4.3 Flavor Management (Conditional Responses)
Flavors are the core feature — each endpoint can have multiple response variants selected based on conditions.

- Add a flavor with a name and priority (higher priority = evaluated first)
- Configure match conditions:
  - **Header matching** — regex patterns (e.g. `Authorization: Bearer admin_.*`)
  - **Body matching** — JSONPath expressions (e.g. `$.role == "admin"`)
  - **Query parameter matching** — exact or regex match (e.g. `page=1`)
- Configure response:
  - HTTP status code
  - Response headers (key-value)
  - Response body (JSON)
  - Response delay in milliseconds (simulate latency)
- Mark one flavor as **default** — returned when no other flavor matches
- Edit and delete flavors
- Reorder flavor priority via drag or priority number

---

### 4.4 Mock Request Handling
The core runtime that intercepts requests and returns configured responses.

- Handle any HTTP method on any configured path
- Match incoming request to a gateway by base path
- Match to an endpoint by method + remaining path
- Evaluate flavors in priority order — first match wins
- Fall back to the default flavor if no conditions match
- Return 404 if no gateway, endpoint, or default flavor is found
- Inject configured response delay before returning
- Log every request (matched or unmatched) for audit and debugging

---

### 4.5 User Authentication & Authorization
Secure access to the admin dashboard.

- Login with username and password
- JWT-based session (access token: 60 min, refresh token: 7 days)
- Automatic token refresh — no re-login on active sessions
- Three roles with different permissions:

| Permission | Admin | Editor | Viewer |
|------------|-------|--------|--------|
| View gateways, endpoints, logs | ✅ | ✅ | ✅ |
| Create / edit gateways & endpoints | ✅ | ✅ | ❌ |
| Delete gateways & endpoints | ✅ | ❌ | ❌ |
| Manage users | ✅ | ❌ | ❌ |

---

### 4.6 User Management
Admin-only control over who can access the platform.

- Create new user accounts with username, email, password, and role
- Edit user details and role
- Activate / deactivate users
- Delete users
- List all users with role and status

---

### 4.7 Request Logs
Visibility into all mock traffic for debugging and monitoring.

- Log every incoming mock request automatically
- Store request details: method, path, headers, body, query params, client IP, timestamp
- Store response details: status code, matched flavor name, response body
- Search and filter logs by gateway, endpoint, method, date range
- View full request/response detail for any log entry
- Identify unmatched requests (no flavor found) for config gaps

---

### 4.8 Dashboard
At-a-glance overview of platform activity.

- Total gateways, endpoints, and flavors configured
- Total requests served (all time and last 24 hours)
- Top 5 most-hit endpoints
- Recent request log entries
- Count of unmatched requests (requests that returned 404)

---

### 4.9 JSON Editor
Inline editing of request/response JSON payloads.

- Syntax-highlighted JSON editor for flavor response bodies
- Format / prettify JSON automatically
- Validate JSON before saving — prevent malformed responses
- Copy JSON to clipboard
- Collapse / expand nested objects

---

### 4.10 Config Reload
Keep the mock service in sync without downtime.

- Admin service automatically signals the mock service to reload after any create, update, or delete operation
- Reload happens in-memory — no container restart required
- Health endpoint exposes reload status and number of configs loaded

---

*Document Owner: Wajih Aslam | Last Updated: 2026-05-15*
