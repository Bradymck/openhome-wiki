```yaml
title: platform/abilities
entity_type: documentation
status: live
last_updated: 2026-05-05
```

## what-it-is
Abilities are modular voice plugins within the OpenHome platform that add new skills to conversational AI agents, known as Personalities. They enable Personalities to perform tasks, access external APIs, and interact with connected devices.

## how-it-works
Abilities in the OpenHome platform can be triggered by specific hotwords during voice interactions. The primary structure of an Ability consists of several key components: 
- **main.py** handles the voice flow within a sandboxed environment, similar to other Abilities.
- **devkit_functions.py** operates on the DevKit hardware, managing hardware-level tasks.
- **requirements.txt** specifies the necessary Python packages for devkit_functions.py.

Abilities support various functionalities such as calling APIs, playing music, running quizzes, and controlling smart devices. They allow for direct hardware access, restricted Python libraries, and long-running tasks, facilitating more complex interactions and enhanced performance.

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

<!-- synthesized: 2026-05-05T11:25:48Z -->
