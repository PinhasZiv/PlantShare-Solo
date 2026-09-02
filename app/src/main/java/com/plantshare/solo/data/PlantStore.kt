package com.plantshare.solo.data

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.io.File

/**
 * The whole database: one JSON file in the app's private storage. A household
 * has tens of plants, not thousands, so a file read on startup costs nothing
 * and avoids pulling in a database and its annotation processor.
 */
class PlantStore(context: Context) {

    private val file = File(context.filesDir, "plants.json")
    private val backup = File(context.filesDir, "plants.backup.json")

    private val _plants = MutableStateFlow(readFromDisk())
    val plants: StateFlow<List<Plant>> = _plants.asStateFlow()

    fun snapshot(): List<Plant> = _plants.value

    // ---- edits --------------------------------------------------------------

    fun add(name: String, periodDays: Int, dueToday: Boolean, notes: String = "") {
        val today = Due.today()
        val plant = Plant(
            name = name.trim(),
            periodDays = periodDays.coerceAtLeast(1),
            nextDueEpochDay = if (dueToday) today else today + periodDays,
            notes = notes.trim(),
        )
        update(_plants.value + plant)
    }

    fun edit(id: String, name: String, periodDays: Int) {
        update(_plants.value.map {
            if (it.id == id) it.copy(name = name.trim(), periodDays = periodDays.coerceAtLeast(1))
            else it
        })
    }

    fun delete(id: String) {
        update(_plants.value.filterNot { it.id == id })
    }

    /**
     * The next due day is measured from today, not from the day it *was* due,
     * so a late plant doesn't stay permanently behind schedule.
     */
    fun markWatered(id: String) {
        val today = Due.today()
        update(_plants.value.map { plant ->
            if (plant.id != id) plant
            else plant.copy(
                lastWateredEpochDay = today,
                nextDueEpochDay = today + plant.periodDays.coerceAtLeast(1),
            )
        })
    }

    fun undoWatering(id: String, previousDueEpochDay: Long, previousLastWatered: Long) {
        update(_plants.value.map { plant ->
            if (plant.id != id) plant
            else plant.copy(
                lastWateredEpochDay = previousLastWatered,
                nextDueEpochDay = previousDueEpochDay,
            )
        })
    }

    // ---- backup -------------------------------------------------------------

    fun exportJson(): String = Plant.listToJson(_plants.value)

    /** Replaces everything. Throws if the text isn't a valid export. */
    fun importJson(text: String) {
        val imported = Plant.listFromJson(text)
        update(imported)
    }

    // ---- disk ---------------------------------------------------------------

    private fun update(plants: List<Plant>) {
        val sorted = plants.sortedBy { it.name.lowercase() }
        _plants.value = sorted
        writeToDisk(sorted)
    }

    private fun readFromDisk(): List<Plant> {
        val source = when {
            file.exists() -> file
            backup.exists() -> backup
            else -> return emptyList()
        }
        return runCatching { Plant.listFromJson(source.readText()) }.getOrDefault(emptyList())
    }

    private fun writeToDisk(plants: List<Plant>) {
        runCatching {
            // Keep the previous good copy so a crash mid-write can't lose everything.
            if (file.exists()) file.copyTo(backup, overwrite = true)
            file.writeText(Plant.listToJson(plants))
        }
    }
}
