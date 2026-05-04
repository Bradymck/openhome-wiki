```yaml
title: Abilities/News-Brief
entity_type: abilities
status: live
last_updated: 2026-05-04
```

## what-it-does
News-Brief is an ability designed to passively track and manage conversational follow-ups. It listens for mentions of individuals in conversations and captures relevant information without requiring user commands. This ability nudges users mid-conversation when follow-ups are overdue and allows users to retrieve information about tracked individuals by querying the recorded data.

## how-to-build
The implementation uses a two-phase detection approach. Initially, it applies a fast keyword filter to recognize when a person's name is mentioned. If a potential mention is detected, it triggers a more intensive language model (LLM) extraction to confirm and log the context. For developers looking to contribute or refine this ability, the implementation details can be found in the related pull request.

## category
utility

## built-by
[[abilities/social-memory]]

## status
live

## connects-to
[[abilities/aquaprime]], [[abilities/deadman-fm]], [[abilities/trivia]]

<!-- synthesized: 2026-05-04T11:31:37Z -->
