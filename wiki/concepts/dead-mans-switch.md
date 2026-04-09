---
entity: concepts/dead-mans-switch
---

## definition
A dead man's switch is a mechanism that triggers an action if the operator fails to periodically confirm they are still active. In OpenHome context: content, streams, or assets that auto-execute if not renewed.

## why-it-matters
Dead man's switches enable trustless, autonomous systems — a station plays forever until the operator stops renewing. It shifts control from platforms to creators.

## how-it-manifests
deadman.fm uses this mechanism as its core spam throttle and liveness proof. Any station that stops sending heartbeats goes dark automatically.

## connects-to
[[abilities/deadman-fm]], [[concepts/web3-native]], [[platform/abilities]]
