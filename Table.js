import api from './api';
import React, { useState } from 'react';
import { View, TextInput, Button, Alert, Modal, Switch } from 'react-native';

// Example usage in a component
const YourComponent = () => {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [major, setMajor] = useState('');
    const [isAdmin, setIsAdmin] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [editModalVisible, setEditModalVisible] = useState(false);

    const handleLogin = async (email, password) => {
        try {
            const response = await api.login(email, password);
            if (response.success) {
                global.token = response.token; // Store the token
                console.log('Token stored:', global.token);
                // Handle successful login
            }
        } catch (error) {
            console.error('Login failed:', error);
        }
    };

    const handleUpdateUser = async () => {
        try {
            // Make sure we have a token
            if (!global.token) {
                Alert.alert('Error', 'Not authenticated. Please login again.');
                return;
            }

            // Validate inputs
            if (!firstName || !lastName || !email || !major) {
                Alert.alert('Error', 'All fields are required');
                return;
            }

            const userData = {
                first_name: firstName,
                last_name: lastName,
                email: email,
                major: major,
                is_admin: isAdmin ? 1 : 0  // Make sure is_admin is numeric
            };

            console.log('Updating user with data:', {
                userId: selectedUser.ID,
                userData,
                token: global.token // Log token for debugging (remove in production)
            });

            const response = await api.updateUser(selectedUser.ID, userData);

            if (response.success) {
                Alert.alert('Success', 'User updated successfully');
                setEditModalVisible(false);
                clearForm();
                fetchUsers(); // Refresh the users list
            } else {
                Alert.alert('Error', response.error || 'Failed to update user');
            }
        } catch (error) {
            console.error('Error updating user:', error);
            Alert.alert('Error', error.message || 'Failed to update user');
        }
    };

    // Add this helper function to clear the form
    const clearForm = () => {
        setFirstName('');
        setLastName('');
        setEmail('');
        setMajor('');
        setIsAdmin(false);
    };

    // Add this function to populate the form when editing
    const handleEditUser = (user) => {
        if (!user) {
            console.error('No user data provided to handleEditUser');
            return;
        }

        console.log('Populating form with user:', user);
        
        setSelectedUser(user);
        setFirstName(user.first_name || '');
        setLastName(user.last_name || '');
        setEmail(user.email || '');
        setMajor(user.major || '');
        setIsAdmin(user.is_admin === 1);
        setEditModalVisible(true);
    };

    // Add form validation before submission
    const validateForm = () => {
        const errors = [];
        if (!firstName) errors.push('First Name');
        if (!lastName) errors.push('Last Name');
        if (!email) errors.push('Email');
        if (!major) errors.push('Major');

        if (errors.length > 0) {
            Alert.alert(
                'Validation Error',
                `Please fill in the following fields: ${errors.join(', ')}`
            );
            return false;
        }
        return true;
    };

    return (
        <Modal visible={editModalVisible} animationType="slide">
            <View style={styles.modalContainer}>
                <TextInput
                    value={firstName}
                    onChangeText={setFirstName}
                    placeholder="First Name"
                    style={styles.input}
                />
                <TextInput
                    value={lastName}
                    onChangeText={setLastName}
                    placeholder="Last Name"
                    style={styles.input}
                />
                <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Email"
                    style={styles.input}
                />
                <TextInput
                    value={major}
                    onChangeText={setMajor}
                    placeholder="Major"
                    style={styles.input}
                />
                <Switch
                    value={isAdmin}
                    onValueChange={setIsAdmin}
                />
                <Button title="Update" onPress={handleUpdateUser} />
                <Button title="Cancel" onPress={() => {
                    setEditModalVisible(false);
                    clearForm();
                }} />
            </View>
        </Modal>
    );
};
