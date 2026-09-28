## **Founding Engineer \- Take Home Assignment**

## **Disaster Response Coordination Platform**

**Submission Window:** 48 Hours  
**Tech Stack:** Candidate's Choice

### **Objective**

Build a small backend-focused disaster response platform that allows users to create disaster incidents, resolve their locations, find nearby resources, and retrieve community reports.

The objective is to evaluate your ability to design APIs, model data, integrate external services, handle failures, optimize requests, and write maintainable code.

**You are free to choose your technology stack.**

## **1\. Disaster Management**

Implement APIs to:

POST   /disasters  
GET    /disasters  
GET    /disasters/:id  
PATCH  /disasters/:id  
DELETE /disasters/:id

A disaster should contain:

id  
title  
description  
location  
tags  
status  
created\_by  
created\_at  
updated\_at

Support basic filtering, for example:

GET /disasters?tag=flood

Include basic validation and error handling.

## **2\. Location Resolution**

When creating a disaster, the system should be able to determine its location from the description.

Example:

> "Heavy flooding has affected Manhattan, NYC."

The system should extract/identify:

Manhattan, NYC

and resolve it to:

latitude  
longitude

You may use any suitable:

* LLM/AI service  
* Geocoding service  
* Mapping provider  
* Mock service

External API keys are **not mandatory**. A clean mock/fallback implementation is acceptable.

## **3\. Nearby Resources**

Create a resource model containing:

id  
name  
type  
location

Example resource types:

shelter  
hospital  
food  
water  
rescue

Implement:

GET /disasters/:id/resources?lat=\<lat\>\&lng=\<lng\>\&radius=\<km\>

Return resources within the requested radius.

Use an appropriate geospatial approach for your chosen database.

Explain briefly in your README how your solution performs the location-based search.

## **4\. Community Reports**

Implement:

GET /disasters/:id/reports

Reports may come from a mock external social-media service.

Example:

{  
  "content": "Need drinking water near Manhattan",  
  "user": "citizen123",  
  "created\_at": "..."  
}

You do **not** need real Twitter/X access.

Focus on:

* Fetching external data  
* Normalizing the response  
* Handling external API failures  
* Avoiding unnecessary repeated API calls

## **5\. Caching**

Cache the response from at least **one external service**.

You may use:

* Redis  
* Database  
* In-memory cache  
* Any suitable solution

The flow should be:

Request  
   ↓  
Check Cache  
   ↓  
Cache Hit → Return Cached Data  
   ↓  
Cache Miss  
   ↓  
External Service  
   ↓  
Store Response  
   ↓  
Return Response

Use a reasonable TTL.

Briefly explain your caching strategy in the README.

## **6\. Real-Time Update**

Implement a basic real-time mechanism using:

* WebSocket  
* Socket.IO  
* Server-Sent Events  
* Equivalent technology

Emit an event whenever a disaster is created or updated.

Example:

disaster\_updated

A minimal client/test demonstrating the event is sufficient.

## **7\. Authentication & Authorization**

Implement lightweight authentication using any reasonable approach.

You may use mock users.

Example:

admin  
contributor

Demonstrate at least **one authorization rule**.

For example:

admin → create/update/delete  
contributor → create/update

A production-grade authentication system is not required.

## **8\. What We Expect**

We are primarily evaluating:

* API design  
* Code structure  
* Database design  
* Validation  
* Error handling  
* External API integration  
* Caching  
* Geospatial querying  
* Real-time communication  
* Authentication/authorization  
* Testing  
* Engineering judgment

A polished frontend is **not required**.

A simple frontend, Postman collection, Swagger documentation, or API client is sufficient to demonstrate functionality.

## **9\. Testing**

Include tests for at least:

* One API endpoint  
* One validation/error scenario  
* One important business rule  
* One external integration/mock

You do not need complete test coverage.

## **10\. README**

Your README should contain:

### **Setup**

How to run the project locally.

### **Architecture**

A simple diagram or explanation of the major components.

### **Technical Decisions**

Briefly explain:

* Why you selected your database  
* How your geospatial search works  
* How caching works  
* How external API failures are handled

### **Trade-offs**

Mention anything you intentionally simplified or left incomplete.

### **AI Usage**

AI coding tools such as Cursor, Windsurf, GitHub Copilot, ChatGPT, etc. are allowed.

Mention briefly:

Tool used:  
What it helped with:  
What was manually implemented/modified:

We will evaluate your understanding of the submitted code, not how much code was generated.

# **Bonus — Optional**

Implement **one** of the following if you have additional time:

* AI-based image verification  
* Official disaster updates  
* Priority classification of reports  
* Interactive map  
* Background job/queue for external API processing

Do not sacrifice the core requirements for bonus features.

# **Submission**

Please provide:

1. GitHub repository  
2. README  
3. `.env.example`  
4. API documentation / Postman collection  
5. Live demo, if available  
6. Any mock data/setup scripts required to run the project

**Do not commit API keys or secrets.**

# **Evaluation**

| Area | Weight |
| ----- | ----- |
| Backend & API Design | 25% |
| Database & Data Modeling | 20% |
| Code Quality & Architecture | 20% |
| Integrations, Caching & Geospatial Logic | 15% |
| Error Handling & Security | 10% |
| Testing & Documentation | 10% |
| **Total** | **100%** |

## 

## **Final Note**

You have **48 hours to submit** the assignment.

We are **not expecting a production-ready disaster management system**.

We are interested in how you approach a real engineering problem, make technical decisions, handle edge cases, and structure your solution.

**Build less. Think deeply. Explain your decisions.**

