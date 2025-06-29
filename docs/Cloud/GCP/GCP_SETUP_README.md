# GCP Setup for Gmail Push Notifications to AWS

This document provides detailed, step-by-step instructions for configuring Google Cloud Platform (GCP) to send push notifications for new Gmail messages to an external system, such as an AWS endpoint.

## Table of Contents
1.  [Create a Google Cloud Project](#1-create-a-google-cloud-project)
2.  [Enable Required APIs](#2-enable-required-apis)
3.  [Create a Cloud Pub/Sub Topic](#3-create-a-cloud-pubsub-topic)
4.  [Grant Gmail Permissions to the Topic](#4-grant-gmail-permissions-to-the-topic)
5.  [Create a Pub/Sub Subscription](#5-create-a-pubsub-subscription)
6.  [Configure OAuth 2.0 Consent Screen and Credentials](#6-configure-oauth-20-consent-screen-and-credentials)
7.  [Authorize Your Application (Initial Setup)](#7-authorize-your-application-initial-setup)
8.  [Summary of Outputs for AWS](#8-summary-of-outputs-for-aws)

---

### 1. Create a Google Cloud Project

Every resource in GCP belongs to a project.

1.  Navigate to the [Google Cloud Console](https://console.cloud.google.com/).
2.  In the top-left corner, click the project dropdown menu.
3.  In the "Select a project" dialog, click **NEW PROJECT**.
4.  Enter a descriptive **Project name** (e.g., `gmail-to-aws-integration`).
5.  Note the **Project ID** that is automatically generated (e.g., `gmail-to-aws-integration-123456`). You will need this later.
6.  Select a **Billing account** if prompted.
7.  Leave the **Location** as is, or select an organization if applicable.
8.  Click **CREATE**.

### 2. Enable Required APIs

You need to enable the Gmail API and the Cloud Pub/Sub API for your project.

1.  Make sure your newly created project is selected in the project dropdown.
2.  Navigate to **APIs & Services > Library**.
3.  Search for "Gmail API" and click on it.
4.  Click the **ENABLE** button.
5.  Go back to the API Library.
6.  Search for "Cloud Pub/Sub API" and click on it.
7.  Click the **ENABLE** button.

### 3. Create a Cloud Pub/Sub Topic

A Pub/Sub topic is a named resource to which messages are sent by publishers.

1.  In the Cloud Console navigation menu, go to **Pub/Sub > Topics**.
2.  Click **CREATE TOPIC**.
3.  Enter a **Topic ID** (e.g., `gmail-push-notifications`).
4.  Ensure **Add a default subscription** is checked. This creates a subscription for testing, but we will create a specific one for AWS later.
5.  Leave the other settings as default.
6.  Click **CREATE**.

You now have a topic. Its full name will be in the format `projects/YOUR_PROJECT_ID/topics/YOUR_TOPIC_ID`.

### 4. Grant Gmail Permissions to the Topic

You must explicitly grant the Gmail service the permission to publish messages to your newly created topic.

1.  Go to **Pub/Sub > Topics** and click on the **Topic ID** you just created.
2.  In the Topic details page, click on the **PERMISSIONS** tab in the right-side panel. If the panel is not visible, click **SHOW INFO PANEL**.
3.  Click **ADD PRINCIPAL**.
4.  In the **New principals** field, enter: `gmail-api-push@system.gserviceaccount.com`
5.  In the **Select a role** dropdown, search for and select **Pub/Sub Publisher**.
6.  Click **SAVE**.

A policy will be added, allowing the Gmail API to publish notifications.

### 5. Create a Pub/Sub Subscription

A subscription receives messages from a topic. This subscription will be a "Push" subscription that forwards messages to your AWS API Gateway endpoint.

1.  In the Cloud Console navigation menu, go to **Pub/Sub > Subscriptions**.
2.  Click **CREATE SUBSCRIPTION**.
3.  Enter a **Subscription ID** (e.g., `aws-endpoint-subscriber`).
4.  Select the **Cloud Pub/Sub topic** you created in the previous step from the dropdown.
5.  Under **Delivery type**, select **Push**.
6.  In the **Endpoint URL** field, you will need to enter the URL of the AWS API Gateway you will create later. For now, you can enter a placeholder URL like `https://example.com/placeholder`. **You will need to edit this later and enter the real AWS API Gateway URL.**
7.  **Acknowledgement deadline**: Set this to `60` seconds. This gives your Lambda function enough time to process the message.
8.  Leave the other settings as default.
9.  Click **CREATE**.

### 6. Configure OAuth 2.0 Consent Screen and Credentials

To allow your application (running on AWS Lambda) to access your Gmail data, you need to create OAuth 2.0 credentials.

#### a. Configure Consent Screen

1.  Navigate to **APIs & Services > OAuth consent screen**.
2.  For **User Type**, select **External**.
3.  Click **CREATE**.
4.  Fill in the required information:
    * **App name**: A descriptive name, e.g., `Gmail AWS Processor`.
    * **User support email**: Select your email address.
    * **Developer contact information**: Enter your email address.
5.  Click **SAVE AND CONTINUE**.
6.  On the **Scopes** page, click **ADD OR REMOVE SCOPES**.
7.  In the filter, search for `gmail.readonly` and select the scope `.../auth/gmail.readonly`. This grants read-only access to emails.
8.  Click **UPDATE**.
9.  Click **SAVE AND CONTINUE**.
10. On the **Test users** page, click **ADD USERS**.
11. Enter the Gmail address you want to monitor.
12. Click **ADD**.
13. Click **SAVE AND CONTINUE**.
14. Review the summary and click **BACK TO DASHBOARD**.

#### b. Create Credentials

1.  Navigate to **APIs & Services > Credentials**.
2.  Click **CREATE CREDENTIALS** and select **OAuth client ID**.
3.  For **Application type**, select **Web application**.
4.  Give it a **Name** (e.g., `Gmail-to-AWS-Lambda-Client`).
5.  Under **Authorized redirect URIs**, click **ADD URI**.
6.  Enter `https://developers.google.com/oauthplayground`. This allows you to easily generate the initial refresh token.
7.  Click **CREATE**.
8.  A dialog will appear with your **Client ID** and **Client secret**. Copy both of these and save them securely. You will need them for the next step and for your AWS Lambda function. Click **OK**.
9.  From the credentials list, find the client ID you just created and click the **Download JSON** button. Store this file (`client_secret_....json`) securely.

### 7. Authorize Your Application (Initial Setup)

This is a one-time step to get a **Refresh Token**, which your AWS Lambda function will use to get new access tokens without user interaction.

1.  Go to the [OAuth 2.0 Playground](https://developers.google.com/oauthplayground).
2.  In the top-right corner, click the gear icon (OAuth 2.0 configuration).
3.  Check the box for **Use your own OAuth credentials**.
4.  Enter the **OAuth Client ID** and **OAuth Client secret** you saved earlier.
5.  Close the configuration dialog.
6.  In the **Step 1: Select & authorize APIs** section, find "Gmail API v1" in the list and select the `https://www.googleapis.com/auth/gmail.readonly` scope.
7.  Click the **Authorize APIs** button.
8.  Sign in with the Google account you want to monitor (the one you added as a test user).
9.  If you see a "Google hasn't verified this app" screen, click **Advanced** and then **Go to ... (unsafe)**.
10. Click **Allow** to grant permission.
11. You will be redirected back to the OAuth Playground. In **Step 2: Exchange authorization code for tokens**, you will see an **Authorization code**.
12. Click the **Exchange authorization code for tokens** button.
13. A **Refresh token** and **Access token** will appear. **Copy the Refresh token and save it securely.** This is a critical credential.

### 8. Summary of Outputs for AWS

At the end of this process, you should have the following pieces of information saved securely. These will be used as environment variables or secrets in your AWS Lambda function.

* **GCP Project ID**: (e.g., `gmail-to-aws-integration-123456`)
* **Pub/Sub Topic Name**: (e.g., `projects/YOUR_PROJECT_ID/topics/gmail-push-notifications`)
* **Pub/Sub Subscription Name**: (e.g., `projects/YOUR_PROJECT_ID/subscriptions/aws-endpoint-subscriber`)
* **OAuth Client ID**: From step 6b.
* **OAuth Client Secret**: From step 6b.
* **OAuth Refresh Token**: From step 7.
* The downloaded `client_secret_....json` file content.

You are now ready to set up the AWS side of the integration. Remember to update the Pub/Sub subscription's **Endpoint URL** with your actual AWS API Gateway URL once it's created.
        
