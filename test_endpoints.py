import requests
import json

BASE_URL = "http://localhost:8000/api"

def test_auth():
    print("Testing Auth Endpoints...")

    # # Register
    # register_data = {
    #     "name": "Normal User",
    #     "email": "test@example.com",
    #     "password": "password123"
    # }
    # response = requests.post(f"{BASE_URL}/auth/register", json=register_data)
    # print(f"Register: {response.status_code}")
    # if response.status_code == 200:
    #     token = response.json()["access_token"]
    #     print("Registration successful")
    # else:
    #     print(f"Registration failed: {response.text}")
    #     return None

    # Login
    login_data = {
        "email": "test@example.com",
        "password": "password123"
    }
    response = requests.post(f"{BASE_URL}/auth/login", json=login_data)
    print(f"Login: {response.status_code}")
    if response.status_code == 200:
        token = response.json()["access_token"]
        print("Login successful")
    else:
        print(f"Login failed: {response.text}")
        return None

    # Get me
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get(f"{BASE_URL}/auth/me", headers=headers)
    print(f"Get Me: {response.status_code}")
    if response.status_code == 200:
        print("Get Me successful")
    else:
        print(f"Get Me failed: {response.text}")

    return token

def test_projects(token):
    print("Testing Projects Endpoints...")
    headers = {"Authorization": f"Bearer {token}"}

    # List projects
    response = requests.get(f"{BASE_URL}/projects/", headers=headers)
    print(f"List Projects: {response.status_code}")

    # Create project
    project_data = {
        "name": "Test Project",
        "description": "A test project"
    }
    response = requests.post(f"{BASE_URL}/projects/", json=project_data, headers=headers)
    print(f"Create Project: {response.status_code}")
    if response.status_code == 200:
        project_id = response.json()["id"]
        print(f"Project created with ID: {project_id}")
        return project_id
    else:
        print(f"Create Project failed: {response.text}")
        return None

def test_datasets(token, project_id):
    print("Testing Datasets Endpoints...")
    headers = {"Authorization": f"Bearer {token}"}

    # List datasets
    response = requests.get(f"{BASE_URL}/datasets/", headers=headers)
    print(f"List Datasets: {response.status_code}")

    # Upload dataset
    import tempfile
    import os

    # Create a test CSV file
    test_data = """id,name,price,category,rating,is_active
1,Item_1,100.5,A,4.2,true
2,Item_2,200.0,B,3.8,false
3,Item_3,150.75,C,4.5,true
4,Item_4,300.25,A,4.0,true"""

    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
        f.write(test_data)
        temp_file_path = f.name

    try:
        with open(temp_file_path, 'rb') as f:
            files = {'file': ('test_dataset.csv', f, 'text/csv')}
            data = {'project_id': project_id} if project_id else {}
            response = requests.post(f"{BASE_URL}/datasets/upload", files=files, data=data, headers=headers)
            print(f"Upload Dataset: {response.status_code}")
            if response.status_code == 200:
                dataset_id = response.json()["id"]
                print(f"Dataset uploaded with ID: {dataset_id}")
                return dataset_id
            else:
                print(f"Upload Dataset failed: {response.text}")
                return None
    finally:
        os.unlink(temp_file_path)

def test_runs(token):
    print("Testing Runs Endpoints...")
    headers = {"Authorization": f"Bearer {token}"}

    # List runs
    response = requests.get(f"{BASE_URL}/runs/", headers=headers)
    print(f"List Runs: {response.status_code}")

def test_models(token):
    print("Testing Models Endpoints...")
    headers = {"Authorization": f"Bearer {token}"}

    # List models
    response = requests.get(f"{BASE_URL}/models/", headers=headers)
    print(f"List Models: {response.status_code}")

def test_reports(token):
    print("Testing Reports Endpoints...")
    headers = {"Authorization": f"Bearer {token}"}

    # List reports
    response = requests.get(f"{BASE_URL}/reports/", headers=headers)
    print(f"List Reports: {response.status_code}")

def test_analysis(token):
    print("Testing Analysis Endpoints...")
    headers = {"Authorization": f"Bearer {token}"}

    # List analysis
    response = requests.get(f"{BASE_URL}/analysis/", headers=headers)
    print(f"List Analysis: {response.status_code}")

def test_templates(token):
    print("Testing Templates Endpoints...")
    headers = {"Authorization": f"Bearer {token}"}

    # List templates
    response = requests.get(f"{BASE_URL}/templates/", headers=headers)
    print(f"List Templates: {response.status_code}")

def test_admin(token):
    print("Testing Admin Endpoints...")
    headers = {"Authorization": f"Bearer {token}"}

    # List users (admin only)
    response = requests.get(f"{BASE_URL}/admin/users", headers=headers)
    print(f"List Users: {response.status_code}")

def main():
    token = test_auth()
    if not token:
        print("Auth failed, stopping tests")
        return

    project_id = test_projects(token)
    test_datasets(token, project_id)
    test_runs(token)
    test_models(token)
    test_reports(token)
    test_analysis(token)
    test_templates(token)
    test_admin(token)

    print("All endpoint tests completed.")

if __name__ == "__main__":
    main()
