```yaml
title: platform/openhome
entity_type: platform
status: live
last_updated: 2026-05-06
```

## what-it-is
OpenHome is an open-source Voice AI platform that allows users to build conversational AI agents known as Personalities. These agents can be enhanced with modular voice plugins called Abilities, which add new skills and functionalities.

## how-it-works
OpenHome operates by enabling developers to create AI agents (Personalities) that can interact with users through voice. Developers can set up a Personality by defining its voice, persona, and conversation style, and then augment it with various Abilities. These Abilities are triggered via hotwords during voice conversations and can perform tasks like calling APIs, playing music, controlling smart home devices, and much more. Additionally, recent updates have introduced Local Abilities, which run directly on the DevKit hardware, allowing for tasks that require hardware access, such as managing GPIO, sensors, and executing long-running tasks. Local Abilities utilize a three-file structure to interface between voice flow and hardware functions, providing a seamless experience for users.

## current-status
live

## connects-to
[[platform/speakers]]
[[platform/abilities]]
[[platform/dashboard]]
[[platform/voice-ai]]
[[platform/local-link]]
[[platform/marketplace]]
[[platform/live-editor]]

<!-- synthesized: 2026-05-06T11:32:14Z -->
