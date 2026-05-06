```yaml
title: platform/abilities
entity_type: platform
status: live
last_updated: 2026-05-06
```

## what-it-is
OpenHome Abilities are modular voice plugins that enhance conversational AI agents, referred to as Personalities, by adding new skills and functionalities.

## how-it-works
Abilities are triggered by hotwords during voice interactions and can perform various tasks such as calling APIs, playing music, running quizzes, and controlling smart devices. OpenHome also supports Local Abilities, which run directly on the DevKit hardware, providing capabilities such as direct hardware access, the use of restricted Python libraries, and the ability to execute shell commands. Local Abilities consist of three primary files: `main.py` for handling voice flows, `devkit_functions.py` for hardware-level operations, and `requirements.txt` for listing necessary Python packages.

## current-status
live

## connects-to
[[platform/openhome]]
[[platform/speakers]]
[[platform/dashboard]]
[[platform/voice-ai]]
[[platform/local-link]]
[[platform/marketplace]]
[[platform/live-editor]]

<!-- synthesized: 2026-05-06T11:32:14Z -->
