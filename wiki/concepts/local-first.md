```markdown
---
title: concepts/local-first
entity_type: concepts
status: live
last_updated: 2026-05-05
---

## definition
Local-first refers to the capability of running certain functionalities directly on a user's device or hardware, rather than relying on cloud-based services. This ensures that tasks requiring device-level access can be executed efficiently and in real-time.

## why-it-matters
In the context of OpenHome, local-first functionalities allow developers to create applications that leverage the full potential of local hardware. This enhances user experience by enabling faster responses and improved performance for activities like controlling physical devices, accessing sensors, and executing long-running tasks without the latency of cloud interaction.

## how-it-manifests
Local-first abilities are realized in OpenHome through Local Abilities, which are designed to operate directly on the DevKit hardware. These abilities can access device resources like GPIO pins, sensors, and cameras, allowing for a range of applications not possible through regular cloud-based Abilities. Developers can create Local Abilities by splitting their code into different files, with specific functionalities assigned to dedicated parts for hardware interaction.

## connects-to
[[concepts/abilities-as-apps]]
[[concepts/web3-native]]
[[concepts/dead-mans-switch]]
[[concepts/spatial-intelligence]]
[[concepts/grant-program]]

<!-- synthesized: 2026-05-05T11:25:48Z -->
```
