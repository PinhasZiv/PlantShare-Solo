package com.plantshare.solo.data

import java.time.LocalDate

enum class PlantState {
    /** Watered today. Stays visible today, gone tomorrow. */
    WATERED_TODAY,
    DUE_TODAY,
    LATE,
    UPCOMING,
}

data class PlantStatus(
    val plant: Plant,
    val state: PlantState,
    val daysLate: Int,
) {
    val needsWater: Boolean get() = state == PlantState.DUE_TODAY || state == PlantState.LATE
}

object Due {
    /** Warnings stop after this many days late. The plant stays on the list. */
    const val MAX_LATE_WARNINGS = 3

    fun today(): Long = LocalDate.now().toEpochDay()

    fun statusOf(plant: Plant, today: Long = today()): PlantStatus {
        if (plant.lastWateredEpochDay == today) {
            return PlantStatus(plant, PlantState.WATERED_TODAY, 0)
        }
        val late = (today - plant.nextDueEpochDay).toInt()
        return when {
            late > 0 -> PlantStatus(plant, PlantState.LATE, late)
            late == 0 -> PlantStatus(plant, PlantState.DUE_TODAY, 0)
            else -> PlantStatus(plant, PlantState.UPCOMING, 0)
        }
    }

    fun shouldNotify(status: PlantStatus): Boolean = when (status.state) {
        PlantState.DUE_TODAY -> true
        PlantState.LATE -> status.daysLate <= MAX_LATE_WARNINGS
        else -> false
    }

    fun describe(status: PlantStatus, today: Long = today()): String = when (status.state) {
        PlantState.WATERED_TODAY -> "Watered today"
        PlantState.DUE_TODAY -> "Due today"
        PlantState.LATE ->
            if (status.daysLate == 1) "1 day late" else "${status.daysLate} days late"
        PlantState.UPCOMING -> {
            val d = status.plant.nextDueEpochDay - today
            if (d == 1L) "Due tomorrow" else "Due in $d days"
        }
    }
}
