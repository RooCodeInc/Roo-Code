import { useState, useCallback } from "react"
import {
	DragStartEvent,
	DragOverEvent,
	DragEndEvent,
	UniqueIdentifier,
	useSensors,
	useSensor,
	PointerSensor,
	KeyboardSensor,
} from "@dnd-kit/core"
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable"

import { hookEventTypes, type HookEventType, type HookWithMetadata } from "@roo-code/types"

export interface DragState {
	activeId: UniqueIdentifier | null
	activeHook: HookWithMetadata | null
	overId: UniqueIdentifier | null
	overContainer: HookEventType | null
}

export interface UseHookDragDropProps {
	hooks: HookWithMetadata[]
	moveHook: (hookId: string, fromEventType: HookEventType, toEventType: HookEventType, newIndex: number) => void
	reorderHooks: (eventType: HookEventType, activeId: string, overId: string) => void
	getHooksByEventType: (eventType: HookEventType) => HookWithMetadata[]
	/** Callback when a hook is moved to a different event type (for auto-expanding the target group) */
	onMoveComplete?: (toEventType: HookEventType) => void
}

export interface UseHookDragDropReturn {
	/** Configured sensors for drag and drop */
	sensors: ReturnType<typeof useSensors>

	/** Current drag state */
	dragState: DragState

	/** Handler for drag start */
	handleDragStart: (event: DragStartEvent) => void

	/** Handler for drag over (container detection) */
	handleDragOver: (event: DragOverEvent) => void

	/** Handler for drag end */
	handleDragEnd: (event: DragEndEvent) => void

	/** Handler for drag cancel */
	handleDragCancel: () => void
}

/**
 * Custom hook for managing drag and drop state and handlers for hooks.
 *
 * Features:
 * - Supports dragging hooks within a group to reorder
 * - Supports dragging hooks between groups to change event type
 * - Keyboard support for accessibility
 * - Visual feedback via drag state
 */
export function useHookDragDrop({
	hooks,
	moveHook,
	reorderHooks,
	getHooksByEventType,
	onMoveComplete,
}: UseHookDragDropProps): UseHookDragDropReturn {
	// Configure sensors with activation constraints
	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: {
				distance: 8, // 8px movement before drag starts
			},
		}),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	)

	// Track drag state
	const [dragState, setDragState] = useState<DragState>({
		activeId: null,
		activeHook: null,
		overId: null,
		overContainer: null,
	})

	/**
	 * Find which container (event type) a hook belongs to
	 */
	const findContainer = useCallback(
		(id: UniqueIdentifier): HookEventType | null => {
			// First check if the id is a hook id
			const hook = hooks.find((h) => h.id === id)
			if (hook) {
				return hook.eventType
			}

			// If not a hook, it might be a container id (event type)
			return null
		},
		[hooks],
	)

	/**
	 * Handle drag start - track the active item
	 */
	const handleDragStart = useCallback(
		(event: DragStartEvent) => {
			const { active } = event
			const activeHook = hooks.find((h) => h.id === active.id)

			setDragState({
				activeId: active.id,
				activeHook: activeHook || null,
				overId: null,
				overContainer: activeHook?.eventType || null,
			})
		},
		[hooks],
	)

	/**
	 * Handle drag over - detect when hovering over different containers
	 */
	const handleDragOver = useCallback(
		(event: DragOverEvent) => {
			const { active, over } = event

			if (!over) {
				setDragState((prev) => ({
					...prev,
					overId: null,
					overContainer: null,
				}))
				return
			}

			const activeContainer = findContainer(active.id)
			let overContainer = findContainer(over.id)

			// If over.id is an event type (container), use it directly
			if (!overContainer && typeof over.id === "string") {
				// Check if over.id is actually a container/event type
				if ((hookEventTypes as readonly string[]).includes(over.id)) {
					overContainer = over.id as HookEventType
				}
			}

			setDragState((prev) => ({
				...prev,
				overId: over.id,
				overContainer: overContainer || activeContainer,
			}))
		},
		[findContainer],
	)

	/**
	 * Handle drag end - finalize the move and update state
	 */
	const handleDragEnd = useCallback(
		(event: DragEndEvent) => {
			const { active, over } = event

			if (!over) {
				// Reset drag state
				setDragState({
					activeId: null,
					activeHook: null,
					overId: null,
					overContainer: null,
				})
				return
			}

			const activeId = String(active.id)
			const overId = String(over.id)

			const activeHook = hooks.find((h) => h.id === activeId)
			if (!activeHook) {
				setDragState({
					activeId: null,
					activeHook: null,
					overId: null,
					overContainer: null,
				})
				return
			}

			const activeContainer = activeHook.eventType
			let overContainer: HookEventType | null = null

			// Check if over.id is a hook
			const overHook = hooks.find((h) => h.id === overId)
			if (overHook) {
				overContainer = overHook.eventType
			} else {
				// Check if over.id is a container (event type)
				if ((hookEventTypes as readonly string[]).includes(overId)) {
					overContainer = overId as HookEventType
				}
			}

			if (!overContainer) {
				// Default to the active container if we can't determine the target
				overContainer = activeContainer
			}

			if (activeContainer === overContainer) {
				// Reordering within the same container
				if (activeId !== overId) {
					reorderHooks(activeContainer, activeId, overId)
				}
			} else {
				// Moving to a different container
				const targetHooks = getHooksByEventType(overContainer)
				let newIndex: number

				if (overHook) {
					// Insert at the position of the over hook
					newIndex = targetHooks.findIndex((h) => h.id === overId)
					if (newIndex === -1) {
						newIndex = targetHooks.length
					}
				} else {
					// Insert at the end of the target container
					newIndex = targetHooks.length
				}

				moveHook(activeId, activeContainer, overContainer, newIndex)

				// Auto-expand the target group after cross-container move
				onMoveComplete?.(overContainer)
			}

			// Reset drag state
			setDragState({
				activeId: null,
				activeHook: null,
				overId: null,
				overContainer: null,
			})
		},
		[hooks, moveHook, reorderHooks, getHooksByEventType, onMoveComplete],
	)

	/**
	 * Handle drag cancel - reset state
	 */
	const handleDragCancel = useCallback(() => {
		setDragState({
			activeId: null,
			activeHook: null,
			overId: null,
			overContainer: null,
		})
	}, [])

	return {
		sensors,
		dragState,
		handleDragStart,
		handleDragOver,
		handleDragEnd,
		handleDragCancel,
	}
}
