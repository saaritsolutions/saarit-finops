# ADR-011: API Gateway Strategy

| Field | Value |
|-------|-------|
| Status | **Accepted** |
| Date | 2026-03-29 |
| Deciders | SaaR Architecture Team |
| Regulatory Ref | IDRBT Annexure II — Single URL, browser agnostic, TLS required |

---

## Context

With 8+ microservices running on different ports, the frontend and external clients cannot call each service directly because:
- CORS configuration is complex when services are on different origins
- JWT validation must happen consistently across all services
- Rate limiting must be applied uniformly
- Tenant resolution (X-Bank-Id → schema mapping) must happen in one place
- IDRBT requires a single access URL for the banking application
- TLS must be terminated in one place

An API Gateway provides a single entry point that handles cross-cutting concerns before routing to downstream services.

---

## Decision Options Considered

### Option A: AWS API Gateway / Azure API Management
```
Pros: Managed service, automatic scaling, built-in WAF
Cons:
  - Cloud vendor dependency (RBI requires India region; API Gateway latency)
  - Cost: per-million requests billing
  - IDRBT/RBI: some UCBs are on-premises; cloud API gateway creates mandatory cloud dependency
  - Configuration complexity for custom tenant resolution
Rejected: Vendor dependency, on-prem incompatibility
```

### Option B: Kong / Traefik (API Gateway dedicated software)
```
Pros: Powerful, plugin ecosystem
Cons:
  - Additional infrastructure component to learn and manage
  - Licensing (Kong Enterprise): expensive
  - Configuration complexity for a startup team
Deferred to Phase 2 (when scale requires WAF, advanced rate limiting)
```

### Option C: YARP (Yet Another Reverse Proxy) — .NET-based gateway ✓ Phase 1
```
Pros:
  - Same .NET ecosystem as backend
  - Configured in C# — full flexibility for tenant resolution
  - Can share JWT validation middleware
  - No additional infrastructure — runs as a .NET service
  - Microsoft-maintained, production-ready
Cons:
  - Not as feature-rich as Kong
  - Must implement rate limiting manually
Chosen for Phase 1
```

### Option D: nginx (reverse proxy for deployment) ✓ Always
```
nginx sits in front of everything (even YARP):
  - TLS termination
  - Static file serving for React SPA
  - HTTP → HTTPS redirect
  - Gzip compression
  - Security headers injection
  - DDoS protection (connection rate limits)
Always used (deployment layer)
```

---

## Decision: nginx (TLS/static) + YARP (API routing) combination

### Request Flow
```
Browser / External Client
    │ HTTPS (443)
    ▼
nginx (TLS termination, security headers, static files)
    │
    ├── /                      → React SPA (static files)
    │
    └── /api/*                 → YARP Gateway (.NET)
                                    │
                                    ├── JWT validation (all requests)
                                    ├── Tenant resolution (X-Bank-Id → schema)
                                    ├── Rate limiting (Redis-backed)
                                    ├── Request correlation ID injection
                                    │
                                    └── Route to downstream service:
                                        /api/customer/*    → CustomerService:5200
                                        /api/account/*     → CoreBankingApi:5100
                                        /api/loan/*        → LoanService:5130
                                        /api/payment/*     → PaymentService:5014
                                        /api/workflow/*    → WorkflowService:5012
                                        /api/expression/*  → ExpressionBuilderService:5004
                                        /api/report/*      → ReportingService:5017
                                        /api/identity/*    → IdentityService:5001
                                        /api/notification/* → NotificationService:5015
```

---

## YARP Configuration

```csharp
// Program.cs (ApiGateway service)
builder.Services.AddReverseProxy()
    .LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"));

// Middleware pipeline
app.UseMiddleware<TenantResolutionMiddleware>();  // Resolve X-Bank-Id
app.UseMiddleware<JwtValidationMiddleware>();      // Validate JWT on all /api/* routes
app.UseMiddleware<RateLimitMiddleware>();          // Redis-backed rate limiting
app.UseMiddleware<CorrelationIdMiddleware>();      // Inject X-Correlation-Id
app.MapReverseProxy();
```

```json
// appsettings.json — YARP routing config
{
  "ReverseProxy": {
    "Routes": {
      "customer-route": {
        "ClusterId": "customer-cluster",
        "Match": { "Path": "/api/customer/{**catch-all}" }
      },
      "loan-route": {
        "ClusterId": "loan-cluster",
        "Match": { "Path": "/api/loan/{**catch-all}" }
      },
      "identity-route": {
        "ClusterId": "identity-cluster",
        "Match": { "Path": "/api/identity/{**catch-all}" },
        "AuthorizationPolicy": "anonymous"
      }
    },
    "Clusters": {
      "customer-cluster": {
        "Destinations": {
          "primary": { "Address": "http://customerservice:5200" }
        },
        "HealthCheck": {
          "Active": { "Enabled": true, "Path": "/health" }
        }
      },
      "loan-cluster": {
        "Destinations": {
          "primary": { "Address": "http://loanservice:5130" }
        }
      }
    }
  }
}
```

---

## Tenant Resolution Middleware

```csharp
public class TenantResolutionMiddleware
{
    public async Task InvokeAsync(HttpContext context, ITenantResolver resolver)
    {
        // Skip for identity endpoints (login doesn't have bank context yet)
        if (context.Request.Path.StartsWithSegments("/api/identity"))
        {
            await _next(context);
            return;
        }

        // Option 1: From header
        var bankId = context.Request.Headers["X-Bank-Id"].FirstOrDefault();

        // Option 2: From subdomain (kochi.saarbanking.com → KL001UCB)
        if (bankId == null)
        {
            var host = context.Request.Host.Value;
            bankId = await resolver.ResolveFromSubdomainAsync(host);
        }

        // Option 3: From JWT claims (if user is already authenticated)
        if (bankId == null && context.User.Identity?.IsAuthenticated == true)
        {
            bankId = context.User.FindFirst("bank_id")?.Value;
        }

        if (bankId == null)
            throw new UnauthorizedAccessException("Bank context could not be resolved");

        // Validate bank exists and is active
        var bank = await resolver.ValidateBankAsync(bankId);
        if (!bank.IsActive)
            return context.Response.StatusCode = 503; // Bank not active

        // Inject into downstream request headers
        context.Request.Headers["X-Bank-Id"] = bankId;
        context.Request.Headers["X-Schema-Name"] = $"bank_{bankId.ToLower()}";

        await _next(context);
    }
}
```

---

## nginx Configuration (Production)

```nginx
# /etc/nginx/conf.d/saar-banking.conf

# HTTP → HTTPS redirect
server {
    listen 80;
    server_name demobank.saaritsolutions.com;
    return 301 https://$server_name$request_uri;
}

# Main HTTPS server
server {
    listen 443 ssl http2;
    server_name demobank.saaritsolutions.com;

    ssl_certificate     /etc/letsencrypt/live/demobank.saaritsolutions.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/demobank.saaritsolutions.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'" always;

    # React SPA
    location / {
        root /var/www/saar-frontend;
        try_files $uri $uri/ /index.html;
        gzip on;
        gzip_types text/plain application/javascript application/json text/css;
        expires 1h;
        add_header Cache-Control "public, immutable";
    }

    # API → downstream services (direct routing for Phase 1)
    location /api/identity/ {
        proxy_pass http://identityservice:5001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/customer/ {
        proxy_pass http://customerservice:5200;
        include /etc/nginx/snippets/proxy-headers.conf;
    }

    location /api/loan/ {
        proxy_pass http://loanservice:5130;
        include /etc/nginx/snippets/proxy-headers.conf;
    }

    location /api/workflow/ {
        proxy_pass http://workfloworchestration:5012;
        include /etc/nginx/snippets/proxy-headers.conf;
    }

    location /api/expression/ {
        proxy_pass http://expressionbuilder:5004;
        include /etc/nginx/snippets/proxy-headers.conf;
    }

    # Health check (no auth)
    location /health {
        proxy_pass http://loanservice:5130/health;
        access_log off;
    }
}
```

---

## Phase 2: YARP Migration

When scale requires more sophisticated gateway features:
```
YARP replaces direct nginx proxying for /api/* routes
nginx → YARP → downstream services

New capabilities added:
  - Circuit breaker per service (Polly integration)
  - Weighted load balancing across service instances
  - Response caching for read-heavy endpoints
  - Request transformation (e.g., inject X-Schema-Name from JWT claims)
  - Health check aggregation dashboard
```

---

## Consequences

### Positive
- Single HTTPS entry point satisfies IDRBT thin-client requirement
- Tenant resolution in one place — downstream services trust the injected header
- Security headers applied consistently across all responses
- nginx handles TLS efficiently (hardware-accelerated in Linux)

### Negative / Mitigations
- **Risk:** Gateway is a single point of failure
  - **Mitigation:** nginx configured as active-passive HA pair (Phase 2); Docker restart policy in Phase 1
- **Risk:** Gateway adds latency for every request
  - **Mitigation:** nginx is extremely efficient; YARP adds < 1ms per request
- **Risk:** Tenant resolution failure causes all requests to fail
  - **Mitigation:** Health endpoint bypasses tenant resolution; monitoring alerts on 5xx spike

---

## Related Decisions
- ADR-001: Multi-Tenancy (tenant resolution is a gateway responsibility)
- ADR-007: Security Framework (JWT validation at gateway)
- ADR-012: Deployment (nginx configuration + SSL certificate management)
