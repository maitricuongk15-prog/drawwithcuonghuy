import React from 'react';
import { Platform, ScrollView, StatusBar, Text, TextInput, TouchableOpacity, View } from 'react-native';

export function ProjectsScreen({
  auth,
  drawing,
  projects,
  loadingProjects,
  creatingProject,
  joiningProject,
  deletingProjectId,
  newProjectName,
  setNewProjectName,
  newProjectPassword,
  setNewProjectPassword,
  joinInviteValue,
  setJoinInviteValue,
  joinProjectPassword,
  setJoinProjectPassword,
  onRefresh,
  onCreateProject,
  onJoinProject,
  onDeleteProject,
  styles,
}) {
  return (
    <View style={[styles.container, styles.homeScreen]}>
      <StatusBar barStyle="dark-content" backgroundColor="#e7edf6" />
      <View style={styles.homeHeader}>
        <View>
          <Text style={styles.homeTitle}>Projects</Text>
          <Text style={styles.homeSubtitle}>
            Welcome, {auth.currentUser?.displayName || auth.currentUser?.username || 'User'}
          </Text>
        </View>
        <View style={styles.homeHeaderActions}>
          <TouchableOpacity style={styles.secondaryButton} onPress={onRefresh}>
            <Text style={styles.secondaryButtonText}>{loadingProjects ? 'Loading...' : 'Refresh'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutButton} onPress={auth.handleLogout}>
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.homeContent}>
        <View style={styles.createCard}>
          <Text style={styles.cardTitle}>Create new drawing project</Text>
          <Text style={styles.helperText}>
            You can set a password. Share the invite code shown in recent list so others can join.
          </Text>
          <View style={styles.createForm}>
            <TextInput
              style={[
                styles.input,
                styles.homeInput,
                Platform.OS === 'web' && styles.homeInputWeb,
                styles.createInput,
              ]}
              placeholder="Project name"
              value={newProjectName}
              onChangeText={setNewProjectName}
              editable={!creatingProject}
            />
            <TextInput
              style={[
                styles.input,
                styles.homeInput,
                Platform.OS === 'web' && styles.homeInputWeb,
                styles.createInput,
              ]}
              placeholder="Project password (optional)"
              value={newProjectPassword}
              onChangeText={setNewProjectPassword}
              secureTextEntry
              editable={!creatingProject}
            />
            <TouchableOpacity
              style={[styles.homePrimaryButton, styles.createButton]}
              onPress={onCreateProject}
              disabled={creatingProject}
            >
              <Text style={styles.homePrimaryButtonText}>
                {creatingProject ? 'Creating...' : 'Create'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.projectListCard}>
          <Text style={styles.cardTitle}>Join project by invite code</Text>
          <Text style={styles.helperText}>Enter invite code in format `projectId:joinCode`.</Text>
          <View style={styles.createForm}>
            <TextInput
              style={[
                styles.input,
                styles.homeInput,
                Platform.OS === 'web' && styles.homeInputWeb,
                styles.createInput,
              ]}
              placeholder="Invite code"
              value={joinInviteValue}
              onChangeText={setJoinInviteValue}
              autoCapitalize="none"
              editable={!joiningProject}
            />
            <TextInput
              style={[
                styles.input,
                styles.homeInput,
                Platform.OS === 'web' && styles.homeInputWeb,
                styles.createInput,
              ]}
              placeholder="Project password (if required)"
              value={joinProjectPassword}
              onChangeText={setJoinProjectPassword}
              secureTextEntry
              editable={!joiningProject}
            />
            <TouchableOpacity
              style={[styles.homePrimaryButton, styles.createButton]}
              onPress={onJoinProject}
              disabled={joiningProject}
            >
              <Text style={styles.homePrimaryButtonText}>{joiningProject ? 'Joining...' : 'Join'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.projectListCard, styles.recentProjectsCard]}>
          <Text style={styles.cardTitle}>Recent projects (joined)</Text>
          <ScrollView contentContainerStyle={styles.projectList}>
            {projects.length === 0 ? (
              <Text style={styles.emptyText}>
                {loadingProjects ? 'Loading recent projects...' : 'No recent projects yet.'}
              </Text>
            ) : (
              projects.map((project) => (
                <View key={project.id} style={styles.projectItem}>
                  <View style={styles.projectInfo}>
                    <Text style={styles.projectName}>{project.name}</Text>
                    <Text style={styles.projectMeta}>
                      {project.pathCount || 0} strokes | by {project.createdBy || 'unknown'} | invite code:{' '}
                      {project.shareToken}
                      {project.requiresPassword ? ' | password protected' : ''}
                    </Text>
                  </View>
                  <View style={styles.projectActions}>
                    <TouchableOpacity style={styles.openButton} onPress={() => drawing.joinProject(project)}>
                      <Text style={styles.openButtonText}>Open</Text>
                    </TouchableOpacity>
                    {project.isOwner && (
                      <TouchableOpacity
                        style={styles.deleteButton}
                        disabled={deletingProjectId === String(project.id)}
                        onPress={() => onDeleteProject(project)}
                      >
                        <Text style={styles.deleteButtonText}>
                          {deletingProjectId === String(project.id) ? 'Deleting...' : 'Delete'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
}
