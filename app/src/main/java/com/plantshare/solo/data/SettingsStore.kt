package com.plantshare.solo.data

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore(name = "plantshare_prefs")

data class ReminderSettings(
    val enabled: Boolean = true,
    val hour: Int = 18,
    val minute: Int = 0,
) {
    fun label(): String = String.format("%02d:%02d", hour, minute)
}

class SettingsStore(private val context: Context) {

    private val keyEnabled = booleanPreferencesKey("reminder_enabled")
    private val keyHour = intPreferencesKey("reminder_hour")
    private val keyMinute = intPreferencesKey("reminder_minute")

    val settings: Flow<ReminderSettings> = context.dataStore.data.map { p ->
        ReminderSettings(
            enabled = p[keyEnabled] ?: true,
            hour = p[keyHour] ?: 18,
            minute = p[keyMinute] ?: 0,
        )
    }

    suspend fun current(): ReminderSettings = settings.first()

    suspend fun setTime(hour: Int, minute: Int) {
        context.dataStore.edit {
            it[keyHour] = hour
            it[keyMinute] = minute
        }
    }

    suspend fun setEnabled(enabled: Boolean) {
        context.dataStore.edit { it[keyEnabled] = enabled }
    }
}
