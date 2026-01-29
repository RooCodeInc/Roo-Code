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

## Available Models

Roo Code supports all foundation models available through Amazon Bedrock.

For the complete, up-to-date model list with IDs and capabilities, see [AWS Bedrock's supported models documentation](https://docs.aws.amazon.com/bedrock/latest/userguide/models-supported.html).

**Important:** Use the _model ID_ when configuring Roo Code, not the model name.

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

1.  **Select a supported Claude model** that includes reasoning capabilities.
2.  **Enable Reasoning Mode** in the model settings.
3.  **Adjust the thinking budget** to control how much the model should "think".

This feature is only available for supported Claude models.

## Tips and Notes

- **Permissions:** Ensure your IAM user or role has the necessary permissions to invoke Bedrock models. The `bedrock:InvokeModel` permission is required.
- **Pricing:** Refer to the [Amazon Bedrock pricing](https://aws.amazon.com/bedrock/pricing/) page for details on model costs.
- **Cross-Region Inference:** Using cross-region inference may result in higher latency.
- **VPC Endpoints:** When using VPC endpoints, ensure your endpoint is properly configured to handle Bedrock API calls. This feature is particularly useful for organizations with strict security requirements that mandate keeping all API traffic within their private network.
