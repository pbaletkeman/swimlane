# 📚 Project Capabilities & Core Skills (`SKILLS.md`)

*Last Updated: Jul 23, 2026*

This document serves as a repository for our team's specialized knowledge, architectural guidelines, and potential future service capabilities that are not covered by current code or standard libraries.

---

## 🛡️ Security & Compliance Expertise (High Priority)

**Primary Focus:** Data protection, regulatory adherence (GDPR, HIPAA), and robust authorization practices.

*   **Data Encryption Standards:** Deep understanding of end-to-end encryption requirements for Personally Identifiable Information (PII).
    *   *Skill:* Vaulting encrypted secrets requiring HMAC or KMS integration.
    *   *Guideline:* Never handle plaintext PII outside the minimal requirement boundaries. All sensitive fields must be encrypted at rest and in transit (TLS 1.2+ mandatory).
*   **Regulatory Mapping:** Detailed knowledge of [Specific Compliance Standard, e.g., GDPR Articles/HIPAA Rules].
    *   *Skill:* Implementing `Right to Erasure` workflows across all database providers.
    *   *Action:* Any new feature touching PI must pass a compliance review checklist.
*   **Authorization Deep Dive:** Extending the current role-based access control (RBAC).
    *   *Skill:* Implementing Attribute-Based Access Control (ABAC) for fine-grained permissions (e.g., 'Coach X can only view data for Team Y').

---

## 🚀 Future Service Capabilities & Integrations

**Goal:** Identifying and planning hooks for new functional domains without a full build cycle.

*   **Payment Integration:**
    *   *Skill:* Implementing Stripe/PayPal webhooks for subscription management.
    *   *Prerequisite:* Needs secure handling of sensitive financial data (PCI compliance scope review required).
*   **Advanced Analytics & Telemetry:**
    *   *Skill:* Streaming log data to a dedicated time-series database (e.g., ElasticSearch, InfluxDB) for real-time insights.
    *   *Guideline:* Ensure rate limiting and batching at the ingestion point to prevent service degradation.
*   **External API Connectors:**
    *   *Skill:* Building standardized OAuth flows for integrating with third-party sports performance trackers (e.g., Garmin/Strava).

---

## 🔧 Technical Best Practices & Tooling

*(Optional section reserved for team knowledge)*
*   ...