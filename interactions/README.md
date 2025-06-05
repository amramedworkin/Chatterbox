## `.nodetest/interactions` Folder

This folder is used by **Chatterbox** to record and persist interactions between incoming/outgoing email messages and the OpenAI response process.

### Purpose
1. Records Chatterbox interactions involving the email polling and response workflow.
2. Persists attachments associated with each inbound or outbound email.
3. Captures a complete trace of the OpenAI interaction, including all request inputs.

### Folder Structure
```
.nodetest/
└── interactions/
    └── <guid>/
        └── 001/
        └── 002/
        └── ...
```

- Each `<guid>` folder corresponds to a **conversation ID** — a unique Chatterbox processing session that involves reading an email, generating a response, and sending it.
- Inside each `<guid>`, numbered subfolders like `001`, `002`, etc. represent **each message step** in a multi-part conversation. These are sequential and reflect the order of message exchange.
- Every step folder contains:
  - The original email content (including attachments)
  - Any intermediate files used to prepare the OpenAI request
  - Metadata or logs capturing request/response details

### Additional Details
- The folder structure supports **multi-turn conversations**.
- Status and processing steps are logged within each folder as Chatterbox completes email fulfillment.

> 📌 This folder is **gitignored by default**, except for a placeholder `README.md`, to prevent accidental inclusion of sensitive or large data.
