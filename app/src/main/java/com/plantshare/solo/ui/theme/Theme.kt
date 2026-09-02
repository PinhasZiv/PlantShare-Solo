package com.plantshare.solo.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

// Leaf green carries the app; rust is reserved for one thing only — overdue plants.
private val Leaf = Color(0xFF2E5D43)
private val LeafLight = Color(0xFFDCEADF)
private val Bark = Color(0xFF3E3A34)
private val Paper = Color(0xFFF2F4F0)
private val Rust = Color(0xFF9C4A2F)
private val RustLight = Color(0xFFF6E2DA)

val OverdueColor = Rust
val OverdueContainer = RustLight
val DoneColor = Leaf
val DoneContainer = LeafLight

private val LightColors = lightColorScheme(
    primary = Leaf,
    onPrimary = Color.White,
    primaryContainer = LeafLight,
    onPrimaryContainer = Color(0xFF12301F),
    secondary = Bark,
    background = Paper,
    onBackground = Color(0xFF1B1D19),
    surface = Color.White,
    onSurface = Color(0xFF1B1D19),
    surfaceVariant = Color(0xFFE4E8E1),
    onSurfaceVariant = Color(0xFF4A4F48),
    error = Rust,
    outline = Color(0xFFB9C0B6),
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFF8FCCA6),
    onPrimary = Color(0xFF10301F),
    primaryContainer = Color(0xFF1F4632),
    onPrimaryContainer = Color(0xFFC9E9D5),
    background = Color(0xFF13160F),
    surface = Color(0xFF1B1E19),
    error = Color(0xFFE79070),
)

private val AppTypography = Typography(
    headlineMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.SemiBold,
        fontSize = 26.sp,
        lineHeight = 32.sp,
        letterSpacing = (-0.4).sp,
    ),
    titleMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Medium,
        fontSize = 17.sp,
        lineHeight = 22.sp,
    ),
    bodyMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Normal,
        fontSize = 15.sp,
        lineHeight = 21.sp,
    ),
    labelMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Medium,
        fontSize = 13.sp,
        lineHeight = 17.sp,
    ),
)

@Composable
fun PlantShareTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        typography = AppTypography,
        content = content,
    )
}
