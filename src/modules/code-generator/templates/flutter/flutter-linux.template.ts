import { ProjectContext } from '../template-models';

export function renderFlutterLinuxRootCMake(context: ProjectContext): string {
  const appName = context.artifactId.replace(/[^a-z0-9_]/g, '_').toLowerCase();

  return `cmake_minimum_required(VERSION 3.10)
project(${appName} LANGUAGES CXX)

set(BINARY_NAME "${appName}")
set(APPLICATION_ID "com.uagrm.${appName}")

cmake_policy(SET CMP0063 NEW)

set(CMAKE_INSTALL_RPATH "$ORIGIN/lib")

# Root filesystem for cross-building.
if(CMAKE_SYSROOT)
  set(FLUTTER_SYSTEM_PREFIX "\${CMAKE_SYSROOT}")
else()
  set(FLUTTER_SYSTEM_PREFIX "")
endif()

# Define build configuration
set(CMAKE_CXX_STANDARD 14)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_subdirectory(flutter)
add_subdirectory(runner)
`;
}

export function renderFlutterLinuxFlutterCMake(): string {
  return `# This file controls Flutter-level build steps. It should not be edited.
cmake_minimum_required(VERSION 3.10)

set(EPHEMERAL_DIR "\${CMAKE_CURRENT_SOURCE_DIR}/ephemeral")

# Configuration provided via flutter tool.
include(\${EPHEMERAL_DIR}/generated_config.cmake)

function(list_prepend LIST_NAME PREFIX)
    set(NEW_LIST "")
    foreach(element \${items})
        list(APPEND NEW_LIST "\${PREFIX}\${element}")
    endforeach(element)
    set(\${LIST_NAME} "\${NEW_LIST}" PARENT_SCOPE)
endfunction()

# System-level dependencies.
find_package(PkgConfig REQUIRED)
pkg_check_modules(GTK REQUIRED IMPORTED_TARGET gtk+-3.0)
pkg_check_modules(GLIB REQUIRED IMPORTED_TARGET glib-2.0)
pkg_check_modules(GIO REQUIRED IMPORTED_TARGET gio-2.0)

set(FLUTTER_LIBRARY "\${EPHEMERAL_DIR}/libflutter_linux_gtk.so")
set(FLUTTER_LIBRARY \${FLUTTER_LIBRARY} PARENT_SCOPE)
set(FLUTTER_ICU_DATA_FILE "\${EPHEMERAL_DIR}/icudtl.dat" PARENT_SCOPE)
set(PROJECT_BUILD_DIR "\${PROJECT_DIR}/build/" PARENT_SCOPE)
set(AOT_LIBRARY "\${PROJECT_DIR}/build/lib/libapp.so" PARENT_SCOPE)

add_library(flutter INTERFACE)
target_include_directories(flutter INTERFACE "\${EPHEMERAL_DIR}")
target_link_libraries(flutter INTERFACE "\${FLUTTER_LIBRARY}")
target_link_libraries(flutter INTERFACE PkgConfig::GTK PkgConfig::GLIB PkgConfig::GIO)
add_dependencies(flutter flutter_assemble)

add_custom_command(
  OUTPUT \${FLUTTER_LIBRARY}
  COMMAND \${CMAKE_COMMAND} -E env
    \${FLUTTER_TOOL_ENVIRONMENT}
    "\${FLUTTER_ROOT}/packages/flutter_tools/bin/tool_backend.sh"
      \${FLUTTER_TARGET_PLATFORM} \${CMAKE_BUILD_TYPE}
  VERBATIM
)
add_custom_target(flutter_assemble DEPENDS "\${FLUTTER_LIBRARY}")
`;
}

export function renderFlutterLinuxRunnerCMake(context: ProjectContext): string {
  const appName = context.artifactId.replace(/[^a-z0-9_]/g, '_').toLowerCase();

  return `cmake_minimum_required(VERSION 3.10)
project(runner LANGUAGES CXX)

add_executable(\${BINARY_NAME}
  "main.cc"
  "my_application.cc"
  "\${FLUTTER_MANAGED_DIR}/generated_plugin_registrant.cc"
)

target_include_directories(\${BINARY_NAME} PRIVATE "\${CMAKE_CURRENT_SOURCE_DIR}")
target_link_libraries(\${BINARY_NAME} PRIVATE flutter)
target_link_libraries(\${BINARY_NAME} PRIVATE PkgConfig::GTK)
add_dependencies(\${BINARY_NAME} flutter_assemble)
`;
}

export function renderFlutterLinuxMainCc(): string {
  return `#include "my_application.h"

int main(int argc, char** argv) {
  g_autoptr(MyApplication) app = my_application_new();
  return g_application_run(G_APPLICATION(app), argc, argv);
}
`;
}

export function renderFlutterLinuxMyApplicationH(): string {
  return `#ifndef FLUTTER_MY_APPLICATION_H_
#define FLUTTER_MY_APPLICATION_H_

#include <gtk/gtk.h>

G_DECLARE_FINAL_TYPE(MyApplication, my_application, MY, APPLICATION,
                     GtkApplication)

MyApplication* my_application_new();

#endif  // FLUTTER_MY_APPLICATION_H_
`;
}

export function renderFlutterLinuxMyApplicationCc(context: ProjectContext): string {
  return `#include "my_application.h"

#include <flutter_linux/flutter_linux.h>
#ifdef GDK_WINDOWING_X11
#include <gdk/gdkx.h>
#endif

#include "flutter/generated_plugin_registrant.h"

struct _MyApplication {
  GtkApplication parent_instance;
  char** dart_entrypoint_arguments;
};

G_DEFINE_TYPE(MyApplication, my_application, GTK_TYPE_APPLICATION)

static void my_application_activate(GApplication* application) {
  MyApplication* self = MY_APPLICATION(application);
  GtkWindow* window =
      GTK_WINDOW(gtk_application_window_new(GTK_APPLICATION(application)));

  gtk_window_set_default_size(window, 1280, 720);
  gtk_window_set_title(window, "${context.projectName}");
  gtk_widget_show(GTK_WIDGET(window));

  g_autoptr(FlDartProject) project = fl_dart_project_new();
  fl_dart_project_set_dart_entrypoint_arguments(project, self->dart_entrypoint_arguments);

  FlView* view = fl_view_new(project);
  gtk_widget_show(GTK_WIDGET(view));
  gtk_container_add(GTK_CONTAINER(window), GTK_WIDGET(view));

  fl_register_plugins(FL_PLUGIN_REGISTRY(view));

  gtk_widget_grab_focus(GTK_WIDGET(view));
}

static void my_application_dispose(GObject* object) {
  MyApplication* self = MY_APPLICATION(object);
  g_clear_pointer(&self->dart_entrypoint_arguments, g_strfreev);
  G_OBJECT_CLASS(my_application_parent_class)->dispose(object);
}

static void my_application_init(MyApplication* self) {}

static void my_application_class_init(MyApplicationClass* klass) {
  G_APPLICATION_CLASS(klass)->activate = my_application_activate;
  G_OBJECT_CLASS(klass)->dispose = my_application_dispose;
}

MyApplication* my_application_new() {
  return MY_APPLICATION(g_object_new(my_application_get_type(),
                                     "application-id", APPLICATION_ID,
                                     "flags", G_APPLICATION_NON_UNIQUE,
                                     nullptr));
}
`;
}
