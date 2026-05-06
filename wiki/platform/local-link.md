```markdown
---
title: platform/local-link
entity_type: platform
status: live
last_updated: 2026-05-06
---

### what-it-is
The Local Link is a feature of the OpenHome platform that enables the use of Local Abilities on DevKit hardware, allowing direct interaction with connected devices and hardware-level functions.

### how-it-works
Local Abilities run directly on the DevKit, outside the sandbox environment of regular Abilities. This allows for direct hardware access to components such as LEDs, GPIO pins, sensors, cameras, and other connected devices. A Local Ability is structured across three main files: `main.py`, which manages the voice flow; `devkit_functions.py`, which handles device-level operations; and `requirements.txt`, which includes any necessary Python packages. The communication between these components is facilitated through a function call, allowing the `main.py` script to send commands to `devkit_functions.py`, which executes the commands on the hardware.

### current-status
live

## connects-to
[[platform/openhome]]
[[platform/speakers]]
[[platform/abilities]]
[[platform/dashboard]]
[[platform/voice-ai]]
[[platform/marketplace]]
[[platform/live-editor]]

<!-- synthesized: 2026-05-06T11:32:14Z -->
```
