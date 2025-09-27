---
sidebar_label: AWS Bedrock
description: Use Amazon Bedrock with Roo Code to access Claude, Llama, and other foundation models through AWS. Configure credentials and VPC endpoints.
keywords:
    - aws bedrock
    - amazon bedrock
    - roo code
    - api provider
    - claude bedrock
    - llama bedrock
    - aws ai
    - foundation models
    - vpc endpoint
image: /img/social-share.jpg
---

# Using AWS Bedrock With Roo Code

Roo Code supports accessing models through Amazon Bedrock, a fully managed service that makes a selection of high-performing foundation models (FMs) from leading AI companies available via a single API.

**Website:** [https://aws.amazon.com/bedrock/](https://aws.amazon.com/bedrock/)

---

## Prerequisites

- **AWS Account:** You need an active AWS account.
- **Bedrock Access:** You must request and be granted access to Amazon Bedrock. See the [AWS Bedrock documentation](https://docs.aws.amazon.com/bedrock/latest/userguide/getting-started.html) for details on requesting access.
- **Model Access:** Within Bedrock, you need to request access to the specific models you want to use (e.g., Anthropic Claude).
- **Install AWS CLI:** Use AWS CLI to configure your account for authentication
    ```bash
     aws configure
    ```

---

## Getting Credentials

You have two main options for configuring AWS credentials:

1.  **AWS Access Keys (Recommended for Development):**
    - Create an IAM user with the necessary permissions (at least `bedrock:InvokeModel`).
    - Generate an access key ID and secret access key for that user.
    - _(Optional)_ Create a session token if required by your IAM configuration.
2.  **AWS Profile:**
    - Configure an AWS profile using the AWS CLI or by manually editing your AWS credentials file. See the [AWS CLI documentation](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-profiles.html) for details.

---

## Supported Models

Roo Code supports the following models through Bedrock (based on source code):

- **Amazon:**
    - `amazon.nova-pro-v1:0`
    - `amazon.nova-pro-latency-optimized-v1:0`
    - `amazon.nova-lite-v1:0`
    - `amazon.nova-micro-v1:0`
    - `amazon.titan-text-lite-v1:0`
    - `amazon.titan-text-express-v1:0`
    - `amazon.titan-text-embeddings-v1:0`
    - `amazon.titan-text-embeddings-v2:0`
- **Anthropic:**
    - `anthropic.claude-opus-4.1-20250514-v1:0`
    - `anthropic.claude-opus-4-20250514-v1:0`
    - `anthropic.claude-sonnet-4-20250514-v1:0`
    - `anthropic.claude-3-7-sonnet-20250219-v1:0`
    - `anthropic.claude-3-5-sonnet-20241022-v2:0`
    - `anthropic.claude-3-5-haiku-20241022-v1:0`
    - `anthropic.claude-3-5-sonnet-20240620-v1:0`
    - `anthropic.claude-3-opus-20240229-v1:0`
    - `anthropic.claude-3-sonnet-20240229-v1:0`
    - `anthropic.claude-3-haiku-20240307-v1:0`
    - `anthropic.claude-2-1-v1:0`
    - `anthropic.claude-2-0-v1:0`
    - `anthropic.claude-instant-v1:0`
- **DeepSeek:**
    - `deepseek.r1-v1:0`
- **Meta:**
    - `meta.llama3-3-70b-instruct-v1:0`
    - `meta.llama3-2-90b-instruct-v1:0`
    - `meta.llama3-2-11b-instruct-v1:0`
    - `meta.llama3-2-3b-instruct-v1:0`
    - `meta.llama3-2-1b-instruct-v1:0`
    - `meta.llama3-1-405b-instruct-v1:0`
    - `meta.llama3-1-70b-instruct-v1:0`
    - `meta.llama3-1-70b-instruct-latency-optimized-v1:0`
    - `meta.llama3-1-8b-instruct-v1:0`
    - `meta.llama3-70b-instruct-v1:0`
    - `meta.llama3-8b-instruct-v1:0`

Refer to the [Amazon Bedrock documentation](https://docs.aws.amazon.com/bedrock/latest/userguide/models-supported.html) for the most up-to-date list of available models and their IDs. Make sure to use the _model ID_ when configuring Roo Code, not the model name.

---

## Configuration in Roo Code

1.  **Open Roo Code Settings:** Click the gear icon (<Codicon name="gear" />) in the Roo Code panel.
2.  **Select Provider:** Choose "Bedrock" from the "API Provider" dropdown.
3.  **Select Authentication Method:**
    - **AWS Credentials:**
        - Enter your "AWS Access Key" and "AWS Secret Key."
        - (Optional) Enter your "AWS Session Token" if you're using temporary credentials.
    - **AWS Profile:**
        - Enter your "AWS Profile" name (e.g., "default").
4.  **Select Region:** Choose the AWS region where your Bedrock service is available (e.g., "us-east-1").
5.  **(Optional) Cross-Region Inference:** Check "Use cross-region inference" if you want to access models in a region different from your configured AWS region.
6.  **(Optional) VPC Endpoint:** For enterprise environments:
    - Check "Use VPC Endpoint" to route all Bedrock API calls through your VPC endpoint
    - Enter your VPC endpoint URL in the text field that appears
    - This ensures all LLM transactions remain within your corporate network
7.  **Select Model:** Choose your desired model from the "Model" dropdown.

---

---

## Reasoning Budget for Claude Models

Roo Code supports using the reasoning budget (extended thinking) for Anthropic's Claude models on Bedrock. This allows the model to "think" more before responding, which can be useful for complex tasks.

To enable the reasoning budget:

1.  **Select a supported Claude model** (e.g., `anthropic.claude-opus-4.1-20250514-v1:0`, `anthropic.claude-3-sonnet-20240229-v1:0`).
2.  **Enable Reasoning Mode** in the model settings.
3.  **Adjust the thinking budget** to control how much the model should "think".

This feature is only available for supported Claude models.

## Tips and Notes

- **Permissions:** Ensure your IAM user or role has the necessary permissions to invoke Bedrock models. The `bedrock:InvokeModel` permission is required.
- **Pricing:** Refer to the [Amazon Bedrock pricing](https://aws.amazon.com/bedrock/pricing/) page for details on model costs.
- **Cross-Region Inference:** Using cross-region inference may result in higher latency.
- **VPC Endpoints:** When using VPC endpoints, ensure your endpoint is properly configured to handle Bedrock API calls. This feature is particularly useful for organizations with strict security requirements that mandate keeping all API traffic within their private network.
