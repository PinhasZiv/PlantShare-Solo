package com.plantshare.solo

import com.plantshare.solo.data.Due
import com.plantshare.solo.data.Plant
import com.plantshare.solo.data.PlantState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class DueTest {

    private val today = 20_000L

    private fun plant(nextDue: Long, lastWatered: Long = -1L) =
        Plant(id = "p", name = "Fern", periodDays = 3,
            nextDueEpochDay = nextDue, lastWateredEpochDay = lastWatered)

    @Test fun `due today when next due is today`() {
        assertEquals(PlantState.DUE_TODAY, Due.statusOf(plant(today), today).state)
    }

    @Test fun `watered today wins over being due`() {
        val status = Due.statusOf(plant(today, lastWatered = today), today)
        assertEquals(PlantState.WATERED_TODAY, status.state)
        assertFalse(status.needsWater)
    }

    @Test fun `late count grows by day`() {
        assertEquals(2, Due.statusOf(plant(today - 2), today).daysLate)
    }

    @Test fun `warnings stop after three days late`() {
        assertTrue(Due.shouldNotify(Due.statusOf(plant(today - 3), today)))
        assertFalse(Due.shouldNotify(Due.statusOf(plant(today - 4), today)))
    }

    @Test fun `a plant watered yesterday is due again today`() {
        val p = plant(nextDue = today, lastWatered = today - 1)
        assertEquals(PlantState.DUE_TODAY, Due.statusOf(p, today).state)
    }
}
