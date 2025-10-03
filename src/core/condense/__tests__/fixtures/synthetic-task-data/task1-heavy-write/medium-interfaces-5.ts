/**
 * Medium TypeScript Interfaces File 5
 * Purpose: Cloud infrastructure, deployment, and DevOps types for condensation testing
 */

// Cloud resource types
export interface CloudResource {
	id: string
	arn?: string
	name: string
	type: ResourceType
	provider: CloudProvider
	region: string
	availabilityZone?: string
	tags: ResourceTag[]
	status: ResourceStatus
	createdAt: string
	updatedAt: string
	metadata?: Record<string, unknown>
}

export type CloudProvider = "aws" | "azure" | "gcp" | "digitalocean" | "heroku" | "cloudflare"

export type ResourceType = "compute" | "storage" | "database" | "network" | "security" | "analytics" | "messaging"

export interface ResourceTag {
	key: string
	value: string
}

export type ResourceStatus = "provisioning" | "available" | "updating" | "deleting" | "failed" | "terminated"

// Compute instances
export interface ComputeInstance extends CloudResource {
	instanceType: string
	imageId: string
	vCPUs: number
	memory: number
	storage: StorageConfig[]
	network: NetworkConfig
	publicIp?: string
	privateIp?: string
	keyPair?: string
	securityGroups: string[]
	monitoring: MonitoringConfig
	userData?: string
}

export interface StorageConfig {
	deviceName: string
	volumeId: string
	volumeType: "ssd" | "hdd" | "nvme"
	size: number
	iops?: number
	throughput?: number
	encrypted: boolean
	deleteOnTermination: boolean
}

export interface NetworkConfig {
	vpcId: string
	subnetId: string
	interfaces: NetworkInterface[]
	enableIpForwarding: boolean
	enablePublicIp: boolean
}

export interface NetworkInterface {
	id: string
	isPrimary: boolean
	privateIp: string
	publicIp?: string
	ipv6?: string
	macAddress?: string
	securityGroups: string[]
}

export interface MonitoringConfig {
	enabled: boolean
	detailedMonitoring: boolean
	alarms: CloudWatchAlarm[]
	logs: LoggingConfig
}

export interface CloudWatchAlarm {
	name: string
	metric: string
	threshold: number
	comparison: "greater" | "less" | "equal"
	period: number
	evaluationPeriods: number
	actions: string[]
}

export interface LoggingConfig {
	enabled: boolean
	logGroup: string
	retentionDays: number
	exportToS3?: boolean
}

// Container and orchestration types
export interface Container {
	id: string
	name: string
	image: string
	tag: string
	command?: string[]
	args?: string[]
	env: EnvironmentVariable[]
	ports: PortMapping[]
	volumes: VolumeMount[]
	resources: ResourceRequirements
	healthCheck?: HealthCheck
	restart: RestartPolicy
	status: ContainerStatus
}

export interface EnvironmentVariable {
	name: string
	value?: string
	valueFrom?: EnvironmentValueSource
}

export interface EnvironmentValueSource {
	secretRef?: string
	configMapRef?: string
	fieldRef?: string
}

export interface PortMapping {
	containerPort: number
	hostPort?: number
	protocol: "tcp" | "udp"
	name?: string
}

export interface VolumeMount {
	name: string
	mountPath: string
	subPath?: string
	readOnly: boolean
}

export interface ResourceRequirements {
	requests: ResourceRequest
	limits: ResourceLimit
}

export interface ResourceRequest {
	cpu: string
	memory: string
	ephemeralStorage?: string
}

export interface ResourceLimit {
	cpu: string
	memory: string
	ephemeralStorage?: string
}

export interface HealthCheck {
	type: "http" | "tcp" | "exec"
	path?: string
	port?: number
	command?: string[]
	initialDelaySeconds: number
	periodSeconds: number
	timeoutSeconds: number
	successThreshold: number
	failureThreshold: number
}

export type RestartPolicy = "always" | "on-failure" | "unless-stopped" | "never"

export type ContainerStatus = "creating" | "running" | "paused" | "restarting" | "removing" | "exited" | "dead"

// Kubernetes types
export interface KubernetesDeployment {
	apiVersion: string
	kind: "Deployment"
	metadata: K8sMetadata
	spec: DeploymentSpec
	status?: DeploymentStatus
}

export interface K8sMetadata {
	name: string
	namespace: string
	labels?: Record<string, string>
	annotations?: Record<string, string>
	uid?: string
	creationTimestamp?: string
}

export interface DeploymentSpec {
	replicas: number
	selector: LabelSelector
	template: PodTemplate
	strategy: DeploymentStrategy
	minReadySeconds?: number
	progressDeadlineSeconds?: number
	revisionHistoryLimit?: number
}

export interface LabelSelector {
	matchLabels?: Record<string, string>
	matchExpressions?: LabelSelectorRequirement[]
}

export interface LabelSelectorRequirement {
	key: string
	operator: "In" | "NotIn" | "Exists" | "DoesNotExist"
	values?: string[]
}

export interface PodTemplate {
	metadata: K8sMetadata
	spec: PodSpec
}

export interface PodSpec {
	containers: Container[]
	initContainers?: Container[]
	volumes?: Volume[]
	serviceAccountName?: string
	nodeSelector?: Record<string, string>
	affinity?: Affinity
	tolerations?: Toleration[]
	imagePullSecrets?: string[]
	restartPolicy?: RestartPolicy
}

export interface Volume {
	name: string
	configMap?: ConfigMapVolumeSource
	secret?: SecretVolumeSource
	emptyDir?: EmptyDirVolumeSource
	persistentVolumeClaim?: PersistentVolumeClaimSource
}

export interface ConfigMapVolumeSource {
	name: string
	optional?: boolean
}

export interface SecretVolumeSource {
	secretName: string
	optional?: boolean
}

export interface EmptyDirVolumeSource {
	sizeLimit?: string
}

export interface PersistentVolumeClaimSource {
	claimName: string
	readOnly?: boolean
}

export interface Affinity {
	nodeAffinity?: NodeAffinity
	podAffinity?: PodAffinity
	podAntiAffinity?: PodAffinity
}

export interface NodeAffinity {
	requiredDuringSchedulingIgnoredDuringExecution?: NodeSelector
	preferredDuringSchedulingIgnoredDuringExecution?: PreferredSchedulingTerm[]
}

export interface NodeSelector {
	nodeSelectorTerms: NodeSelectorTerm[]
}

export interface NodeSelectorTerm {
	matchExpressions?: NodeSelectorRequirement[]
}

export interface NodeSelectorRequirement {
	key: string
	operator: string
	values?: string[]
}

export interface PreferredSchedulingTerm {
	weight: number
	preference: NodeSelectorTerm
}

export interface PodAffinity {
	requiredDuringSchedulingIgnoredDuringExecution?: PodAffinityTerm[]
	preferredDuringSchedulingIgnoredDuringExecution?: WeightedPodAffinityTerm[]
}

export interface PodAffinityTerm {
	labelSelector?: LabelSelector
	namespaces?: string[]
	topologyKey: string
}

export interface WeightedPodAffinityTerm {
	weight: number
	podAffinityTerm: PodAffinityTerm
}

export interface Toleration {
	key?: string
	operator?: "Exists" | "Equal"
	value?: string
	effect?: "NoSchedule" | "PreferNoSchedule" | "NoExecute"
	tolerationSeconds?: number
}

export interface DeploymentStrategy {
	type: "Recreate" | "RollingUpdate"
	rollingUpdate?: RollingUpdateStrategy
}

export interface RollingUpdateStrategy {
	maxUnavailable?: number | string
	maxSurge?: number | string
}

export interface DeploymentStatus {
	observedGeneration?: number
	replicas?: number
	updatedReplicas?: number
	readyReplicas?: number
	availableReplicas?: number
	unavailableReplicas?: number
	conditions?: DeploymentCondition[]
}

export interface DeploymentCondition {
	type: string
	status: "True" | "False" | "Unknown"
	lastUpdateTime?: string
	lastTransitionTime?: string
	reason?: string
	message?: string
}

// CI/CD Pipeline types
export interface Pipeline {
	id: string
	name: string
	description?: string
	repository: Repository
	trigger: PipelineTrigger
	stages: PipelineStage[]
	environment: Record<string, string>
	notifications: PipelineNotification[]
	status: PipelineStatus
	createdAt: string
	updatedAt: string
}

export interface Repository {
	url: string
	branch: string
	provider: "github" | "gitlab" | "bitbucket" | "azure-devops"
	credentialsId?: string
}

export interface PipelineTrigger {
	type: TriggerType
	schedule?: string
	branches?: string[]
	paths?: string[]
	events?: string[]
}

export type TriggerType = "manual" | "push" | "pull-request" | "schedule" | "tag" | "webhook"

export interface PipelineStage {
	name: string
	jobs: PipelineJob[]
	dependencies?: string[]
	condition?: string
	timeout?: number
}

export interface PipelineJob {
	name: string
	steps: PipelineStep[]
	environment?: Record<string, string>
	artifacts?: ArtifactConfig[]
	cache?: CacheConfig[]
	services?: ServiceContainer[]
	timeout?: number
}

export interface PipelineStep {
	name: string
	type: StepType
	command?: string
	script?: string
	uses?: string
	with?: Record<string, unknown>
	continueOnError?: boolean
	condition?: string
}

export type StepType = "script" | "checkout" | "build" | "test" | "deploy" | "publish" | "custom"

export interface ArtifactConfig {
	name: string
	paths: string[]
	retention?: number
}

export interface CacheConfig {
	key: string
	paths: string[]
}

export interface ServiceContainer {
	name: string
	image: string
	env?: Record<string, string>
	ports?: number[]
}

export interface PipelineNotification {
	type: "email" | "slack" | "webhook"
	events: PipelineEvent[]
	recipients?: string[]
	url?: string
}

export type PipelineEvent = "started" | "succeeded" | "failed" | "cancelled" | "always"

export type PipelineStatus = "pending" | "running" | "succeeded" | "failed" | "cancelled" | "skipped"
