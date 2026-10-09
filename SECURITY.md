# Security policy

This repository is a tutorial. It contains example code that runs on your own
machine with your own API key, and no hosted service.

## Reporting a problem

Please report a security problem privately: open the repository's **Security**
tab and choose **Report a vulnerability**. Do not open a public issue for it.

Useful reports include:

- a committed secret,
- tutorial code or instructions that would lead a learner to expose their API
  key or other credentials,
- a dependency with a known vulnerability that the tutorial code actually
  reaches.

I answer reports as soon as I can. There is no bounty.

## Your own API key

Your `GEMINI_API_KEY` belongs in `.env`, which Git ignores. If a key ever ends
up in a commit, revoke it in Google AI Studio. Removing the commit is not
enough.
