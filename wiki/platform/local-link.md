```markdown
---
title: platform/local-link
entity_type: platform
status: beta
last_updated: 2026-05-05
---

## what-it-is
Local Link is a feature of the OpenHome platform that enables the execution of local abilities directly on hardware devices, such as the OpenHome DevKit. This allows for more integration with hardware features and devices.

## how-it-works
Local Abilities operate outside the sandbox environment of traditional abilities, providing direct access to hardware components like LEDs, GPIO pins, sensors, and cameras. This capability also allows the use of restricted Python libraries and the execution of shell commands directly from the ability. A Local Ability is structured into three main files: 
- `main.py` manages the voice interaction and operates within a sandboxed environment.
- `devkit_functions.py` interfaces with hardware-level functions on the DevKit.
- `requirements.txt` specifies any external Python packages needed for `devkit_functions.py`. 

When a voice command is executed, `main.py` utilizes the `send_devkit_capability_action()` function to call hardware-related functions defined in `devkit_functions.py`, enabling real-time interaction with the DevKit's hardware.

## current-status
beta

## connects-to
- [[platform/openhome]]
- [[platform/speakers]]
- [[platform/abilities]]
- [[platform/dashboard]]
- [[platform/voice-ai]]
- [[platform/marketplace]]
- [[platform/live-editor]]

<!-- synthesized: 2026-05-05T11:25:48Z -->
```
