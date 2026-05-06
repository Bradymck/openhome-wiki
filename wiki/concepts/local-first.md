```markdown
---
title: Local First
entity_type: concepts
status: live
last_updated: 2026-05-06
---

## definition
Local First refers to the approach within the OpenHome platform where certain functionalities and applications are designed to operate directly on local hardware without requiring a constant internet connection. This enables capabilities that were previously restricted by relying solely on cloud infrastructure.

## why-it-matters
The Local First concept is significant for OpenHome as it enhances the reliability and responsiveness of voice AI interactions. By processing data locally, OpenHome can provide more immediate feedback and control, particularly in scenarios where network connectivity may be intermittent or unavailable. This empowers users with greater autonomy and ensures that critical functionalities are always accessible.

## how-it-manifests
Local First is implemented through the use of Local Abilities in OpenHome's development kits, which allow for direct hardware access to features such as LEDs, sensors, cameras, and other connected devices. Local Abilities run outside the live editor's sandbox environment, granting developers the ability to execute long-running tasks and use restricted Python libraries not available in the sandbox. For instance, a Local Ability can access device-level data, perform shell commands, and manage multiple device interactions seamlessly.

## connects-to
[[concepts/abilities-as-apps]]
[[concepts/web3-native]]
[[concepts/spatial-intelligence]]
[[concepts/dead-mans-switch]]

<!-- synthesized: 2026-05-06T11:32:14Z -->
```
