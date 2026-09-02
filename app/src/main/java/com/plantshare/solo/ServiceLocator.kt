package com.plantshare.solo

import android.content.Context
import com.plantshare.solo.data.PlantStore
import com.plantshare.solo.data.SettingsStore

object ServiceLocator {

    @Volatile private var plants: PlantStore? = null
    @Volatile private var settings: SettingsStore? = null

    fun plantStore(context: Context): PlantStore =
        plants ?: synchronized(this) {
            plants ?: PlantStore(context.applicationContext).also { plants = it }
        }

    fun settingsStore(context: Context): SettingsStore =
        settings ?: synchronized(this) {
            settings ?: SettingsStore(context.applicationContext).also { settings = it }
        }
}
