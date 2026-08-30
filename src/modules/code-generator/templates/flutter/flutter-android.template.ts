import { ProjectContext } from '../template-models';

export function renderFlutterAndroidBuildGradle(): string {
  return `allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
subprojects {
    project.evaluationDependsOn(":app")
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
`;
}

export function renderFlutterAndroidSettingsGradle(): string {
  return `pluginManagement {
    val flutterSdkPath =
        run {
            val properties = java.util.Properties()
            val localProp = file("local.properties")
            if (localProp.exists()) {
                localProp.inputStream().use { properties.load(it) }
            }
            val path = properties.getProperty("flutter.sdk")
            path ?: System.getenv("FLUTTER_ROOT") ?: "/run/current-system/sw"
        }

    includeBuild("$rootDir/.flutter_tools/gradle")

    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

plugins {
    id("dev.flutter.flutter-plugin-loader") version "1.0.0"
    id("com.android.application") version "9.0.1" apply false
    id("org.jetbrains.kotlin.android") version "2.3.20" apply false
}

include(":app")
`;
}

export function renderFlutterAndroidAppBuildGradle(context: ProjectContext): string {
  const appId = `com.example.${context.artifactId.replace(/[^a-z0-9_]/g, '_').toLowerCase()}`;

  return `plugins {
    id("com.android.application")
    id("dev.flutter.flutter-gradle-plugin")
}

android {
    namespace = "${appId}"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        applicationId = "${appId}"
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("debug")
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}
`;
}

export function renderFlutterAndroidManifest(context: ProjectContext): string {
  return `<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <!-- Permiso de Internet para comunicarse con el Backend REST vía USB / WiFi -->
    <uses-permission android:name="android.permission.INTERNET"/>
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>

    <application
        android:label="${context.projectName}"
        android:name="\${applicationName}"
        android:icon="@android:drawable/sym_def_app_icon"
        android:usesCleartextTraffic="true">
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:launchMode="singleTop"
            android:taskAffinity=""
            android:theme="@style/LaunchTheme"
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|smallestScreenSize|locale|layoutDirection|fontScale|screenLayout|density|uiMode"
            android:hardwareAccelerated="true"
            android:windowSoftInputMode="adjustResize">
            <meta-data
              android:name="io.flutter.embedding.android.NormalTheme"
              android:resource="@style/NormalTheme"
              />
            <intent-filter>
                <action android:name="android.intent.action.MAIN"/>
                <category android:name="android.intent.category.LAUNCHER"/>
            </intent-filter>
        </activity>
        <meta-data
            android:name="flutterEmbedding"
            android:value="2" />
    </application>
</manifest>
`;
}

export function renderFlutterMainActivity(context: ProjectContext): string {
  const appId = `com.example.${context.artifactId.replace(/[^a-z0-9_]/g, '_').toLowerCase()}`;

  return `package ${appId}

import io.flutter.embedding.android.FlutterActivity

class MainActivity : FlutterActivity()
`;
}

export function renderFlutterLocalProperties(): string {
  return `sdk.dir=/home/evert/Android/Sdk
flutter.sdk=/nix/store/495v060lrzv2whzlwb62ci0a145ama79-flutter-wrapped-3.44.4-sdk-links
flutter.buildMode=debug
flutter.versionName=1.0.0
flutter.versionCode=1
`;
}

export function renderFlutterGradleProperties(): string {
  return `org.gradle.jvmargs=-Xmx8G -XX:MaxMetaspaceSize=4G -XX:ReservedCodeCacheSize=512m -XX:+HeapDumpOnOutOfMemoryError
android.useAndroidX=true
android.newDsl=false
android.builtInKotlin=false
`;
}

export function renderFlutterGradleWrapperProperties(): string {
  return `distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
distributionUrl=https\\://services.gradle.org/distributions/gradle-9.1.0-all.zip
`;
}

export function renderFlutterMetadata(): string {
  return `version:
  revision: "nixpkgs000000000000000000000000000000000"
  channel: "stable"

project_type: app

migration:
  platforms:
    - platform: root
      create_revision: nixpkgs000000000000000000000000000000000
      base_revision: nixpkgs000000000000000000000000000000000
    - platform: android
      create_revision: nixpkgs000000000000000000000000000000000
      base_revision: nixpkgs000000000000000000000000000000000
`;
}

export function renderFlutterEngineVersion(): string {
  return `a10d8ac38de835021c8d2f920dbf50a920ccc030\n`;
}

export function renderFlutterStylesXml(): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="LaunchTheme" parent="@android:style/Theme.Light.NoTitleBar">
        <item name="android:windowBackground">?android:colorBackground</item>
    </style>
    <style name="NormalTheme" parent="@android:style/Theme.Light.NoTitleBar">
        <item name="android:windowBackground">?android:colorBackground</item>
    </style>
</resources>
`;
}
