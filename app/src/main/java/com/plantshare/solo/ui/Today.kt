package com.plantshare.solo.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.compose.ui.platform.LocalLifecycleOwner
import com.plantshare.solo.data.Due

/**
 * Today's epoch day, refreshed every time the screen is resumed. Without this,
 * an app left open overnight would still be showing yesterday's list.
 */
@Composable
fun rememberToday(): Long {
    var today by remember { mutableLongStateOf(Due.today()) }
    val owner = LocalLifecycleOwner.current

    DisposableEffect(owner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) today = Due.today()
        }
        owner.lifecycle.addObserver(observer)
        onDispose { owner.lifecycle.removeObserver(observer) }
    }
    return today
}
