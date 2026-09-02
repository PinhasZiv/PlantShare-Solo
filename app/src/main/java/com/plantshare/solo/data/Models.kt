package com.plantshare.solo.data

import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

/**
 * Dates are epoch days (days since 1970-01-01), not timestamps. A plant is due
 * on a calendar day, which keeps the "already watered this evening" and "gone by
 * tomorrow" rules simple.
 */
data class Plant(
    val id: String = UUID.randomUUID().toString(),
    val name: String = "",
    val periodDays: Int = 7,
    val nextDueEpochDay: Long = 0L,
    val lastWateredEpochDay: Long = -1L,
    val notes: String = "",
) {
    fun toJson(): JSONObject = JSONObject().apply {
        put("id", id)
        put("name", name)
        put("periodDays", periodDays)
        put("nextDueEpochDay", nextDueEpochDay)
        put("lastWateredEpochDay", lastWateredEpochDay)
        put("notes", notes)
    }

    companion object {
        fun fromJson(o: JSONObject) = Plant(
            id = o.optString("id", UUID.randomUUID().toString()),
            name = o.optString("name"),
            periodDays = o.optInt("periodDays", 7).coerceAtLeast(1),
            nextDueEpochDay = o.optLong("nextDueEpochDay", 0L),
            lastWateredEpochDay = o.optLong("lastWateredEpochDay", -1L),
            notes = o.optString("notes"),
        )

        fun listToJson(plants: List<Plant>): String {
            val array = JSONArray()
            plants.forEach { array.put(it.toJson()) }
            return JSONObject().put("version", 1).put("plants", array).toString(2)
        }

        fun listFromJson(text: String): List<Plant> {
            val root = JSONObject(text)
            val array = root.optJSONArray("plants") ?: JSONArray()
            return (0 until array.length()).map { fromJson(array.getJSONObject(it)) }
        }
    }
}
