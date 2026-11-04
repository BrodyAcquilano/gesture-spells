# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

gesture-spells: turn motion-captured hand gestures, such as drawing a rune in the air or a spell-casting motion, into animations and video effects.

It is a learning project, like the owner's earlier ones: [mnist](https://github.com/BrodyAcquilano/mnist) (a fully connected network) and [convolution-mnist](https://github.com/BrodyAcquilano/convolution-mnist) (a convolutional network), both written from scratch in JavaScript with React and Vite. Clarity matters more than speed or the last bit of accuracy.

## Status

The repository has only a README so far. Nothing has been decided yet about the stack, how hands are tracked (camera and a hand-tracking model, or recorded motion data), how gestures are recognised, or how the animations are made. Propose options and let the owner choose. Do not pick a stack by starting to build one.

## Working with the owner

- Explain new ideas at the level of someone who has built and understands a fully connected and a convolutional network, including backpropagation.
- Ask before adding any package. In the earlier projects the network code had to be hand-written with no maths or machine-learning library. Ask whether that also applies here before reaching for one, for example for hand tracking.
- When there is maths to verify, check it (for example a numerical gradient check) and report the numbers, and check in before building UI on top of it.
- Run the lint and build commands, once they exist, before calling something finished, and say plainly what could not be checked without seeing the browser.
- Don't create GitHub repositories or push without being asked.

Update this file once the stack and structure exist; at that point running `/init` will add the commands and layout.
