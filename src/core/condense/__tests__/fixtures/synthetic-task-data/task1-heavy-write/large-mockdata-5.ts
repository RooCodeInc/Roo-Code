/**
 * Large Mock Data File 5
 * Purpose: Cloud infrastructure and deployment configurations for condensation testing
 */

export const mockCloudResources = [
	{
		id: "res_001",
		arn: "arn:aws:ec2:us-west-1:123456789012:instance/i-1234567890abcdef0",
		name: "api-gateway-prod-01",
		type: "compute",
		provider: "aws",
		region: "us-west-1",
		availabilityZone: "us-west-1a",
		tags: [
			{ key: "Environment", value: "production" },
			{ key: "Service", value: "api-gateway" },
			{ key: "Team", value: "platform" },
			{ key: "CostCenter", value: "engineering" },
		],
		status: "available",
		createdAt: "2023-12-01T00:00:00Z",
		updatedAt: "2024-01-15T10:00:00Z",
		metadata: {
			instanceType: "t3.medium",
			imageId: "ami-0abcdef1234567890",
			vCPUs: 2,
			memory: 4096,
			publicIp: "54.183.45.67",
			privateIp: "10.0.1.42",
		},
	},
	{
		id: "res_002",
		arn: "arn:aws:rds:us-west-1:123456789012:db:products-db-prod",
		name: "products-db-prod",
		type: "database",
		provider: "aws",
		region: "us-west-1",
		availabilityZone: "us-west-1b",
		tags: [
			{ key: "Environment", value: "production" },
			{ key: "Service", value: "product-service" },
			{ key: "Team", value: "backend" },
			{ key: "CostCenter", value: "engineering" },
		],
		status: "available",
		createdAt: "2023-11-15T00:00:00Z",
		updatedAt: "2024-01-15T10:00:00Z",
		metadata: {
			engine: "postgres",
			engineVersion: "15.4",
			instanceClass: "db.t3.medium",
			allocatedStorage: 100,
			storageType: "gp3",
			multiAZ: true,
			backupRetention: 7,
		},
	},
]

export const mockContainers = [
	{
		id: "cnt_001",
		name: "api-gateway",
		image: "example/api-gateway",
		tag: "2.4.1",
		command: ["node", "server.js"],
		args: ["--port=8080"],
		env: [
			{ name: "NODE_ENV", value: "production", valueFrom: null },
			{ name: "LOG_LEVEL", value: "info", valueFrom: null },
			{ name: "DATABASE_URL", value: null, valueFrom: { secretRef: "db-credentials" } },
			{ name: "REDIS_URL", value: null, valueFrom: { secretRef: "redis-credentials" } },
		],
		ports: [
			{ containerPort: 8080, hostPort: 8080, protocol: "tcp", name: "http" },
			{ containerPort: 9090, hostPort: 9090, protocol: "tcp", name: "metrics" },
		],
		volumes: [
			{ name: "config", mountPath: "/app/config", subPath: null, readOnly: true },
			{ name: "logs", mountPath: "/var/log/app", subPath: null, readOnly: false },
		],
		resources: {
			requests: {
				cpu: "500m",
				memory: "1Gi",
				ephemeralStorage: null,
			},
			limits: {
				cpu: "2000m",
				memory: "4Gi",
				ephemeralStorage: null,
			},
		},
		healthCheck: {
			type: "http",
			path: "/health",
			port: 8080,
			command: null,
			initialDelaySeconds: 30,
			periodSeconds: 10,
			timeoutSeconds: 5,
			successThreshold: 1,
			failureThreshold: 3,
		},
		restart: "always",
		status: "running",
	},
]

export const mockKubernetesDeployments = [
	{
		apiVersion: "apps/v1",
		kind: "Deployment",
		metadata: {
			name: "api-gateway",
			namespace: "production",
			labels: {
				app: "api-gateway",
				version: "2.4.1",
				tier: "backend",
			},
			annotations: {
				"deployment.kubernetes.io/revision": "42",
				"kubectl.kubernetes.io/last-applied-configuration": "{...}",
			},
			uid: "12345678-1234-1234-1234-123456789012",
			creationTimestamp: "2023-12-01T00:00:00Z",
		},
		spec: {
			replicas: 3,
			selector: {
				matchLabels: {
					app: "api-gateway",
				},
				matchExpressions: [],
			},
			template: {
				metadata: {
					name: "api-gateway",
					namespace: "production",
					labels: {
						app: "api-gateway",
						version: "2.4.1",
						tier: "backend",
					},
					annotations: {},
					uid: null,
					creationTimestamp: null,
				},
				spec: {
					containers: [
						{
							id: "cnt_001",
							name: "api-gateway",
							image: "example/api-gateway",
							tag: "2.4.1",
							command: ["node", "server.js"],
							args: ["--port=8080"],
							env: [
								{ name: "NODE_ENV", value: "production", valueFrom: null },
								{ name: "LOG_LEVEL", value: "info", valueFrom: null },
							],
							ports: [{ containerPort: 8080, hostPort: null, protocol: "tcp", name: "http" }],
							volumes: [],
							resources: {
								requests: {
									cpu: "500m",
									memory: "1Gi",
									ephemeralStorage: null,
								},
								limits: {
									cpu: "2000m",
									memory: "4Gi",
									ephemeralStorage: null,
								},
							},
							healthCheck: {
								type: "http",
								path: "/health",
								port: 8080,
								command: null,
								initialDelaySeconds: 30,
								periodSeconds: 10,
								timeoutSeconds: 5,
								successThreshold: 1,
								failureThreshold: 3,
							},
							restart: "always",
							status: "running",
						},
					],
					initContainers: [],
					volumes: [
						{
							name: "config",
							configMap: { name: "api-gateway-config", optional: false },
							secret: null,
							emptyDir: null,
							persistentVolumeClaim: null,
						},
					],
					serviceAccountName: "api-gateway",
					nodeSelector: {
						"kubernetes.io/os": "linux",
						"node.kubernetes.io/instance-type": "t3.medium",
					},
					affinity: {
						nodeAffinity: {
							requiredDuringSchedulingIgnoredDuringExecution: {
								nodeSelectorTerms: [
									{
										matchExpressions: [
											{
												key: "kubernetes.io/arch",
												operator: "In",
												values: ["amd64", "arm64"],
											},
										],
									},
								],
							},
							preferredDuringSchedulingIgnoredDuringExecution: [],
						},
						podAffinity: null,
						podAntiAffinity: {
							requiredDuringSchedulingIgnoredDuringExecution: [],
							preferredDuringSchedulingIgnoredDuringExecution: [
								{
									weight: 100,
									podAffinityTerm: {
										labelSelector: {
											matchLabels: { app: "api-gateway" },
											matchExpressions: [],
										},
										namespaces: ["production"],
										topologyKey: "kubernetes.io/hostname",
									},
								},
							],
						},
					},
					tolerations: [
						{
							key: "node.kubernetes.io/not-ready",
							operator: "Exists",
							value: null,
							effect: "NoExecute",
							tolerationSeconds: 300,
						},
					],
					imagePullSecrets: ["registry-credentials"],
					restartPolicy: "always",
				},
			},
			strategy: {
				type: "RollingUpdate",
				rollingUpdate: {
					maxUnavailable: 1,
					maxSurge: 1,
				},
			},
			minReadySeconds: 10,
			progressDeadlineSeconds: 600,
			revisionHistoryLimit: 10,
		},
		status: {
			observedGeneration: 42,
			replicas: 3,
			updatedReplicas: 3,
			readyReplicas: 3,
			availableReplicas: 3,
			unavailableReplicas: 0,
			conditions: [
				{
					type: "Available",
					status: "True",
					lastUpdateTime: "2024-01-15T10:00:00Z",
					lastTransitionTime: "2024-01-15T09:55:00Z",
					reason: "MinimumReplicasAvailable",
					message: "Deployment has minimum availability.",
				},
				{
					type: "Progressing",
					status: "True",
					lastUpdateTime: "2024-01-15T10:00:00Z",
					lastTransitionTime: "2024-01-15T09:50:00Z",
					reason: "NewReplicaSetAvailable",
					message: 'ReplicaSet "api-gateway-7d4f5c6b8" has successfully progressed.',
				},
			],
		},
	},
]

export const mockPipelines = [
	{
		id: "pipe_001",
		name: "api-gateway-ci-cd",
		description: "Continuous integration and deployment pipeline for API Gateway service",
		repository: {
			url: "https://github.com/example/api-gateway",
			branch: "main",
			provider: "github",
			credentialsId: "github-token",
		},
		trigger: {
			type: "push",
			schedule: null,
			branches: ["main", "develop"],
			paths: ["src/**", "package.json", "Dockerfile"],
			events: ["push", "pull_request"],
		},
		stages: [
			{
				name: "Build",
				jobs: [
					{
						name: "compile",
						steps: [
							{
								name: "Checkout code",
								type: "checkout",
								command: null,
								script: null,
								uses: "actions/checkout@v4",
								with: { "fetch-depth": 0 },
								continueOnError: false,
								condition: null,
							},
							{
								name: "Setup Node.js",
								type: "custom",
								command: null,
								script: null,
								uses: "actions/setup-node@v4",
								with: { "node-version": "20" },
								continueOnError: false,
								condition: null,
							},
							{
								name: "Install dependencies",
								type: "script",
								command: "npm ci",
								script: null,
								uses: null,
								with: null,
								continueOnError: false,
								condition: null,
							},
							{
								name: "Run linter",
								type: "script",
								command: "npm run lint",
								script: null,
								uses: null,
								with: null,
								continueOnError: false,
								condition: null,
							},
							{
								name: "Run tests",
								type: "test",
								command: "npm test",
								script: null,
								uses: null,
								with: null,
								continueOnError: false,
								condition: null,
							},
							{
								name: "Build application",
								type: "build",
								command: "npm run build",
								script: null,
								uses: null,
								with: null,
								continueOnError: false,
								condition: null,
							},
						],
						environment: {
							NODE_ENV: "test",
							CI: "true",
						},
						artifacts: [
							{
								name: "build-output",
								paths: ["dist/**", "package.json"],
								retention: 7,
							},
						],
						cache: [
							{
								key: "npm-${{ hashFiles('package-lock.json') }}",
								paths: ["node_modules"],
							},
						],
						services: [],
						timeout: 1800,
					},
				],
				dependencies: [],
				condition: null,
				timeout: 3600,
			},
			{
				name: "Deploy",
				jobs: [
					{
						name: "deploy-production",
						steps: [
							{
								name: "Download build artifacts",
								type: "custom",
								command: null,
								script: null,
								uses: "actions/download-artifact@v4",
								with: { name: "build-output" },
								continueOnError: false,
								condition: null,
							},
							{
								name: "Deploy to Kubernetes",
								type: "deploy",
								command: null,
								script: "kubectl apply -f k8s/production/",
								uses: null,
								with: null,
								continueOnError: false,
								condition: null,
							},
							{
								name: "Wait for rollout",
								type: "script",
								command: "kubectl rollout status deployment/api-gateway -n production",
								script: null,
								uses: null,
								with: null,
								continueOnError: false,
								condition: null,
							},
						],
						environment: {
							KUBECONFIG: "/home/runner/.kube/config",
							ENVIRONMENT: "production",
						},
						artifacts: [],
						cache: [],
						services: [],
						timeout: 1800,
					},
				],
				dependencies: ["Build"],
				condition: "success() && github.ref == 'refs/heads/main'",
				timeout: 3600,
			},
		],
		environment: {
			NODE_VERSION: "20",
			DOCKER_REGISTRY: "ghcr.io/example",
		},
		notifications: [
			{
				type: "slack",
				events: ["failed", "succeeded"],
				recipients: null,
				url: "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXX",
			},
			{
				type: "email",
				events: ["failed"],
				recipients: ["team@example.com"],
				url: null,
			},
		],
		status: "succeeded",
		createdAt: "2024-01-15T09:00:00Z",
		updatedAt: "2024-01-15T09:45:00Z",
	},
]
