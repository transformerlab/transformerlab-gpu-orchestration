# openapi_client.DefaultApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**add_node_api_v1_clusters_cluster_name_nodes_post**](DefaultApi.md#add_node_api_v1_clusters_cluster_name_nodes_post) | **POST** /api/v1/clusters/{cluster_name}/nodes | Add Node
[**add_organization_member_api_v1_admin_orgs_organization_id_members_post**](DefaultApi.md#add_organization_member_api_v1_admin_orgs_organization_id_members_post) | **POST** /api/v1/admin/orgs/{organization_id}/members | Add Organization Member
[**auth_callback_api_v1_auth_callback_get**](DefaultApi.md#auth_callback_api_v1_auth_callback_get) | **GET** /api/v1/auth/callback | Auth Callback
[**cancel_cluster_job_api_v1_skypilot_jobs_cluster_name_job_id_cancel_post**](DefaultApi.md#cancel_cluster_job_api_v1_skypilot_jobs_cluster_name_job_id_cancel_post) | **POST** /api/v1/skypilot/jobs/{cluster_name}/{job_id}/cancel | Cancel Cluster Job
[**check_auth_api_v1_auth_check_get**](DefaultApi.md#check_auth_api_v1_auth_check_get) | **GET** /api/v1/auth/check | Check Auth
[**create_api_key_api_v1_api_keys_post**](DefaultApi.md#create_api_key_api_v1_api_keys_post) | **POST** /api/v1/api-keys | Create Api Key
[**create_cluster_api_v1_clusters_post**](DefaultApi.md#create_cluster_api_v1_clusters_post) | **POST** /api/v1/clusters | Create Cluster
[**create_organization_api_v1_admin_orgs_post**](DefaultApi.md#create_organization_api_v1_admin_orgs_post) | **POST** /api/v1/admin/orgs | Create Organization
[**delete_api_key_api_v1_api_keys_key_id_delete**](DefaultApi.md#delete_api_key_api_v1_api_keys_key_id_delete) | **DELETE** /api/v1/api-keys/{key_id} | Delete Api Key
[**delete_azure_config_route_api_v1_skypilot_azure_config_config_key_delete**](DefaultApi.md#delete_azure_config_route_api_v1_skypilot_azure_config_config_key_delete) | **DELETE** /api/v1/skypilot/azure/config/{config_key} | Delete Azure Config Route
[**delete_cluster_api_v1_clusters_cluster_name_delete**](DefaultApi.md#delete_cluster_api_v1_clusters_cluster_name_delete) | **DELETE** /api/v1/clusters/{cluster_name} | Delete Cluster
[**delete_identity_file_api_v1_clusters_identity_files_file_path_delete**](DefaultApi.md#delete_identity_file_api_v1_clusters_identity_files_file_path_delete) | **DELETE** /api/v1/clusters/identity-files/{file_path} | Delete Identity File
[**delete_organization_api_v1_admin_orgs_organization_id_delete**](DefaultApi.md#delete_organization_api_v1_admin_orgs_organization_id_delete) | **DELETE** /api/v1/admin/orgs/{organization_id} | Delete Organization
[**delete_runpod_config_route_api_v1_skypilot_runpod_config_config_key_delete**](DefaultApi.md#delete_runpod_config_route_api_v1_skypilot_runpod_config_config_key_delete) | **DELETE** /api/v1/skypilot/runpod/config/{config_key} | Delete Runpod Config Route
[**down_skypilot_cluster_api_v1_skypilot_down_post**](DefaultApi.md#down_skypilot_cluster_api_v1_skypilot_down_post) | **POST** /api/v1/skypilot/down | Down Skypilot Cluster
[**fetch_cluster_resources_api_v1_skypilot_fetch_resources_cluster_name_get**](DefaultApi.md#fetch_cluster_resources_api_v1_skypilot_fetch_resources_cluster_name_get) | **GET** /api/v1/skypilot/fetch-resources/{cluster_name} | Fetch Cluster Resources
[**get_active_port_forwards_api_v1_skypilot_port_forwards_get**](DefaultApi.md#get_active_port_forwards_api_v1_skypilot_port_forwards_get) | **GET** /api/v1/skypilot/port-forwards | Get Active Port Forwards
[**get_all_cluster_platforms_api_v1_skypilot_cluster_platforms_get**](DefaultApi.md#get_all_cluster_platforms_api_v1_skypilot_cluster_platforms_get) | **GET** /api/v1/skypilot/cluster-platforms | Get All Cluster Platforms
[**get_api_key_api_v1_api_keys_key_id_get**](DefaultApi.md#get_api_key_api_v1_api_keys_key_id_get) | **GET** /api/v1/api-keys/{key_id} | Get Api Key
[**get_availability_reports_api_v1_reports_availability_get**](DefaultApi.md#get_availability_reports_api_v1_reports_availability_get) | **GET** /api/v1/reports/availability | Get Availability Reports
[**get_azure_config_actual_api_v1_skypilot_azure_config_actual_get**](DefaultApi.md#get_azure_config_actual_api_v1_skypilot_azure_config_actual_get) | **GET** /api/v1/skypilot/azure/config/actual | Get Azure Config Actual
[**get_azure_config_api_v1_skypilot_azure_config_get**](DefaultApi.md#get_azure_config_api_v1_skypilot_azure_config_get) | **GET** /api/v1/skypilot/azure/config | Get Azure Config
[**get_azure_credentials_api_v1_skypilot_azure_credentials_get**](DefaultApi.md#get_azure_credentials_api_v1_skypilot_azure_credentials_get) | **GET** /api/v1/skypilot/azure/credentials | Get Azure Credentials
[**get_azure_instance_types_route_api_v1_skypilot_azure_instance_types_get**](DefaultApi.md#get_azure_instance_types_route_api_v1_skypilot_azure_instance_types_get) | **GET** /api/v1/skypilot/azure/instance-types | Get Azure Instance Types Route
[**get_azure_instances_api_v1_skypilot_azure_instances_get**](DefaultApi.md#get_azure_instances_api_v1_skypilot_azure_instances_get) | **GET** /api/v1/skypilot/azure/instances | Get Azure Instances
[**get_azure_regions_route_api_v1_skypilot_azure_regions_get**](DefaultApi.md#get_azure_regions_route_api_v1_skypilot_azure_regions_get) | **GET** /api/v1/skypilot/azure/regions | Get Azure Regions Route
[**get_cluster_api_v1_clusters_cluster_name_get**](DefaultApi.md#get_cluster_api_v1_clusters_cluster_name_get) | **GET** /api/v1/clusters/{cluster_name} | Get Cluster
[**get_cluster_job_logs_api_v1_skypilot_jobs_cluster_name_job_id_logs_get**](DefaultApi.md#get_cluster_job_logs_api_v1_skypilot_jobs_cluster_name_job_id_logs_get) | **GET** /api/v1/skypilot/jobs/{cluster_name}/{job_id}/logs | Get Cluster Job Logs
[**get_cluster_jobs_api_v1_skypilot_jobs_cluster_name_get**](DefaultApi.md#get_cluster_jobs_api_v1_skypilot_jobs_cluster_name_get) | **GET** /api/v1/skypilot/jobs/{cluster_name} | Get Cluster Jobs
[**get_cluster_platform_info_api_v1_skypilot_cluster_platform_cluster_name_get**](DefaultApi.md#get_cluster_platform_info_api_v1_skypilot_cluster_platform_cluster_name_get) | **GET** /api/v1/skypilot/cluster-platform/{cluster_name} | Get Cluster Platform Info
[**get_cluster_template_info_api_v1_skypilot_cluster_template_cluster_name_get**](DefaultApi.md#get_cluster_template_info_api_v1_skypilot_cluster_template_cluster_name_get) | **GET** /api/v1/skypilot/cluster-template/{cluster_name} | Get Cluster Template Info
[**get_cluster_type_api_v1_skypilot_cluster_type_cluster_name_get**](DefaultApi.md#get_cluster_type_api_v1_skypilot_cluster_type_cluster_name_get) | **GET** /api/v1/skypilot/cluster-type/{cluster_name} | Get Cluster Type
[**get_cost_report_api_v1_skypilot_cost_report_get**](DefaultApi.md#get_cost_report_api_v1_skypilot_cost_report_get) | **GET** /api/v1/skypilot/cost-report | Get Cost Report
[**get_current_user_info_api_v1_auth_me_get**](DefaultApi.md#get_current_user_info_api_v1_auth_me_get) | **GET** /api/v1/auth/me | Get Current User Info
[**get_job_success_reports_api_v1_reports_job_success_get**](DefaultApi.md#get_job_success_reports_api_v1_reports_job_success_get) | **GET** /api/v1/reports/job-success | Get Job Success Reports
[**get_login_url_api_v1_auth_login_url_get**](DefaultApi.md#get_login_url_api_v1_auth_login_url_get) | **GET** /api/v1/auth/login-url | Get Login Url
[**get_node_pools_api_v1_node_pools_get**](DefaultApi.md#get_node_pools_api_v1_node_pools_get) | **GET** /api/v1/node-pools | Get Node Pools
[**get_organization_api_v1_admin_orgs_organization_id_get**](DefaultApi.md#get_organization_api_v1_admin_orgs_organization_id_get) | **GET** /api/v1/admin/orgs/{organization_id} | Get Organization
[**get_past_job_logs_api_v1_skypilot_past_jobs_cluster_name_job_id_logs_get**](DefaultApi.md#get_past_job_logs_api_v1_skypilot_past_jobs_cluster_name_job_id_logs_get) | **GET** /api/v1/skypilot/past-jobs/{cluster_name}/{job_id}/logs | Get Past Job Logs
[**get_past_jobs_endpoint_api_v1_skypilot_past_jobs_get**](DefaultApi.md#get_past_jobs_endpoint_api_v1_skypilot_past_jobs_get) | **GET** /api/v1/skypilot/past-jobs | Get Past Jobs Endpoint
[**get_runpod_config_api_v1_skypilot_runpod_config_get**](DefaultApi.md#get_runpod_config_api_v1_skypilot_runpod_config_get) | **GET** /api/v1/skypilot/runpod/config | Get Runpod Config
[**get_runpod_display_options_route_api_v1_skypilot_runpod_display_options_get**](DefaultApi.md#get_runpod_display_options_route_api_v1_skypilot_runpod_display_options_get) | **GET** /api/v1/skypilot/runpod/display-options | Get Runpod Display Options Route
[**get_runpod_display_options_with_pricing_route_api_v1_skypilot_runpod_display_options_with_pricing_get**](DefaultApi.md#get_runpod_display_options_with_pricing_route_api_v1_skypilot_runpod_display_options_with_pricing_get) | **GET** /api/v1/skypilot/runpod/display-options-with-pricing | Get Runpod Display Options With Pricing Route
[**get_runpod_gpu_types_route_api_v1_skypilot_runpod_gpu_types_get**](DefaultApi.md#get_runpod_gpu_types_route_api_v1_skypilot_runpod_gpu_types_get) | **GET** /api/v1/skypilot/runpod/gpu-types | Get Runpod Gpu Types Route
[**get_runpod_gpu_types_with_pricing_route_api_v1_skypilot_runpod_gpu_types_with_pricing_get**](DefaultApi.md#get_runpod_gpu_types_with_pricing_route_api_v1_skypilot_runpod_gpu_types_with_pricing_get) | **GET** /api/v1/skypilot/runpod/gpu-types-with-pricing | Get Runpod Gpu Types With Pricing Route
[**get_runpod_instances_api_v1_skypilot_runpod_instances_get**](DefaultApi.md#get_runpod_instances_api_v1_skypilot_runpod_instances_get) | **GET** /api/v1/skypilot/runpod/instances | Get Runpod Instances
[**get_skypilot_cluster_status_api_v1_skypilot_status_get**](DefaultApi.md#get_skypilot_cluster_status_api_v1_skypilot_status_get) | **GET** /api/v1/skypilot/status | Get Skypilot Cluster Status
[**get_skypilot_request_status_api_v1_skypilot_request_request_id_get**](DefaultApi.md#get_skypilot_request_status_api_v1_skypilot_request_request_id_get) | **GET** /api/v1/skypilot/request/{request_id} | Get Skypilot Request Status
[**get_ssh_node_info_api_v1_skypilot_ssh_node_info_get**](DefaultApi.md#get_ssh_node_info_api_v1_skypilot_ssh_node_info_get) | **GET** /api/v1/skypilot/ssh-node-info | Get Ssh Node Info
[**get_usage_reports_api_v1_reports_usage_get**](DefaultApi.md#get_usage_reports_api_v1_reports_usage_get) | **GET** /api/v1/reports/usage | Get Usage Reports
[**get_user_reports_api_v1_reports_get**](DefaultApi.md#get_user_reports_api_v1_reports_get) | **GET** /api/v1/reports | Get User Reports
[**get_vscode_tunnel_info_endpoint_api_v1_skypilot_jobs_cluster_name_job_id_vscode_info_get**](DefaultApi.md#get_vscode_tunnel_info_endpoint_api_v1_skypilot_jobs_cluster_name_job_id_vscode_info_get) | **GET** /api/v1/skypilot/jobs/{cluster_name}/{job_id}/vscode-info | Get Vscode Tunnel Info Endpoint
[**launch_skypilot_cluster_api_v1_skypilot_launch_post**](DefaultApi.md#launch_skypilot_cluster_api_v1_skypilot_launch_post) | **POST** /api/v1/skypilot/launch | Launch Skypilot Cluster
[**list_all_organizations_api_v1_admin_orgs_get**](DefaultApi.md#list_all_organizations_api_v1_admin_orgs_get) | **GET** /api/v1/admin/orgs | List All Organizations
[**list_api_keys_api_v1_api_keys_get**](DefaultApi.md#list_api_keys_api_v1_api_keys_get) | **GET** /api/v1/api-keys | List Api Keys
[**list_clusters_api_v1_clusters_get**](DefaultApi.md#list_clusters_api_v1_clusters_get) | **GET** /api/v1/clusters | List Clusters
[**list_identity_files_api_v1_clusters_identity_files_get**](DefaultApi.md#list_identity_files_api_v1_clusters_identity_files_get) | **GET** /api/v1/clusters/identity-files | List Identity Files
[**list_node_pools_api_v1_skypilot_node_pools_get**](DefaultApi.md#list_node_pools_api_v1_skypilot_node_pools_get) | **GET** /api/v1/skypilot/node-pools | List Node Pools
[**list_organization_members_api_v1_admin_orgs_organization_id_members_get**](DefaultApi.md#list_organization_members_api_v1_admin_orgs_organization_id_members_get) | **GET** /api/v1/admin/orgs/{organization_id}/members | List Organization Members
[**list_ssh_clusters_api_v1_skypilot_ssh_clusters_get**](DefaultApi.md#list_ssh_clusters_api_v1_skypilot_ssh_clusters_get) | **GET** /api/v1/skypilot/ssh-clusters | List Ssh Clusters
[**logout_api_v1_auth_logout_get**](DefaultApi.md#logout_api_v1_auth_logout_get) | **GET** /api/v1/auth/logout | Logout
[**refresh_session_api_v1_auth_refresh_post**](DefaultApi.md#refresh_session_api_v1_auth_refresh_post) | **POST** /api/v1/auth/refresh | Refresh Session
[**regenerate_api_key_api_v1_api_keys_key_id_regenerate_post**](DefaultApi.md#regenerate_api_key_api_v1_api_keys_key_id_regenerate_post) | **POST** /api/v1/api-keys/{key_id}/regenerate | Regenerate Api Key
[**remove_node_api_v1_clusters_cluster_name_nodes_node_ip_delete**](DefaultApi.md#remove_node_api_v1_clusters_cluster_name_nodes_node_ip_delete) | **DELETE** /api/v1/clusters/{cluster_name}/nodes/{node_ip} | Remove Node
[**remove_organization_member_api_v1_admin_orgs_organization_id_members_user_id_delete**](DefaultApi.md#remove_organization_member_api_v1_admin_orgs_organization_id_members_user_id_delete) | **DELETE** /api/v1/admin/orgs/{organization_id}/members/{user_id} | Remove Organization Member
[**rename_identity_file_route_api_v1_clusters_identity_files_file_path_put**](DefaultApi.md#rename_identity_file_route_api_v1_clusters_identity_files_file_path_put) | **PUT** /api/v1/clusters/identity-files/{file_path} | Rename Identity File Route
[**run_sky_check_azure_route_api_v1_skypilot_azure_sky_check_get**](DefaultApi.md#run_sky_check_azure_route_api_v1_skypilot_azure_sky_check_get) | **GET** /api/v1/skypilot/azure/sky-check | Run Sky Check Azure Route
[**run_sky_check_runpod_route_api_v1_skypilot_runpod_sky_check_get**](DefaultApi.md#run_sky_check_runpod_route_api_v1_skypilot_runpod_sky_check_get) | **GET** /api/v1/skypilot/runpod/sky-check | Run Sky Check Runpod Route
[**save_azure_config_route_api_v1_skypilot_azure_config_post**](DefaultApi.md#save_azure_config_route_api_v1_skypilot_azure_config_post) | **POST** /api/v1/skypilot/azure/config | Save Azure Config Route
[**save_runpod_config_route_api_v1_skypilot_runpod_config_post**](DefaultApi.md#save_runpod_config_route_api_v1_skypilot_runpod_config_post) | **POST** /api/v1/skypilot/runpod/config | Save Runpod Config Route
[**send_organization_invitation_api_v1_admin_orgs_organization_id_invitations_post**](DefaultApi.md#send_organization_invitation_api_v1_admin_orgs_organization_id_invitations_post) | **POST** /api/v1/admin/orgs/{organization_id}/invitations | Send Organization Invitation
[**serve_frontend_path_get**](DefaultApi.md#serve_frontend_path_get) | **GET** /{path} | Serve Frontend
[**set_azure_default_config_route_api_v1_skypilot_azure_config_config_key_set_default_post**](DefaultApi.md#set_azure_default_config_route_api_v1_skypilot_azure_config_config_key_set_default_post) | **POST** /api/v1/skypilot/azure/config/{config_key}/set-default | Set Azure Default Config Route
[**set_runpod_default_config_route_api_v1_skypilot_runpod_config_config_key_set_default_post**](DefaultApi.md#set_runpod_default_config_route_api_v1_skypilot_runpod_config_config_key_set_default_post) | **POST** /api/v1/skypilot/runpod/config/{config_key}/set-default | Set Runpod Default Config Route
[**setup_azure_api_v1_skypilot_azure_setup_get**](DefaultApi.md#setup_azure_api_v1_skypilot_azure_setup_get) | **GET** /api/v1/skypilot/azure/setup | Setup Azure
[**setup_job_port_forward_api_v1_skypilot_jobs_cluster_name_job_id_setup_port_forward_post**](DefaultApi.md#setup_job_port_forward_api_v1_skypilot_jobs_cluster_name_job_id_setup_port_forward_post) | **POST** /api/v1/skypilot/jobs/{cluster_name}/{job_id}/setup-port-forward | Setup Job Port Forward
[**setup_runpod_api_v1_skypilot_runpod_setup_get**](DefaultApi.md#setup_runpod_api_v1_skypilot_runpod_setup_get) | **GET** /api/v1/skypilot/runpod/setup | Setup Runpod
[**start_web_ssh_session_api_v1_skypilot_ssh_session_cluster_name_get**](DefaultApi.md#start_web_ssh_session_api_v1_skypilot_ssh_session_cluster_name_get) | **GET** /api/v1/skypilot/ssh-session/{cluster_name} | Start Web Ssh Session
[**stop_port_forward_api_v1_skypilot_port_forwards_cluster_name_stop_post**](DefaultApi.md#stop_port_forward_api_v1_skypilot_port_forwards_cluster_name_stop_post) | **POST** /api/v1/skypilot/port-forwards/{cluster_name}/stop | Stop Port Forward
[**stop_skypilot_cluster_api_v1_skypilot_stop_post**](DefaultApi.md#stop_skypilot_cluster_api_v1_skypilot_stop_post) | **POST** /api/v1/skypilot/stop | Stop Skypilot Cluster
[**stream_skypilot_logs_api_v1_skypilot_stream_logs_logfile_get**](DefaultApi.md#stream_skypilot_logs_api_v1_skypilot_stream_logs_logfile_get) | **GET** /api/v1/skypilot/stream-logs/{logfile} | Stream Skypilot Logs
[**submit_job_to_cluster_api_v1_skypilot_jobs_cluster_name_submit_post**](DefaultApi.md#submit_job_to_cluster_api_v1_skypilot_jobs_cluster_name_submit_post) | **POST** /api/v1/skypilot/jobs/{cluster_name}/submit | Submit Job To Cluster
[**terminal_connect_api_v1_terminal_get**](DefaultApi.md#terminal_connect_api_v1_terminal_get) | **GET** /api/v1/terminal | Terminal Connect
[**test_azure_connection_route_api_v1_skypilot_azure_test_post**](DefaultApi.md#test_azure_connection_route_api_v1_skypilot_azure_test_post) | **POST** /api/v1/skypilot/azure/test | Test Azure Connection Route
[**test_runpod_connection_route_api_v1_skypilot_runpod_test_post**](DefaultApi.md#test_runpod_connection_route_api_v1_skypilot_runpod_test_post) | **POST** /api/v1/skypilot/runpod/test | Test Runpod Connection Route
[**update_api_key_api_v1_api_keys_key_id_put**](DefaultApi.md#update_api_key_api_v1_api_keys_key_id_put) | **PUT** /api/v1/api-keys/{key_id} | Update Api Key
[**update_member_role_api_v1_admin_orgs_organization_id_members_user_id_role_put**](DefaultApi.md#update_member_role_api_v1_admin_orgs_organization_id_members_user_id_role_put) | **PUT** /api/v1/admin/orgs/{organization_id}/members/{user_id}/role | Update Member Role
[**upload_identity_file_api_v1_clusters_identity_files_post**](DefaultApi.md#upload_identity_file_api_v1_clusters_identity_files_post) | **POST** /api/v1/clusters/identity-files | Upload Identity File
[**verify_azure_api_v1_skypilot_azure_verify_get**](DefaultApi.md#verify_azure_api_v1_skypilot_azure_verify_get) | **GET** /api/v1/skypilot/azure/verify | Verify Azure
[**verify_runpod_api_v1_skypilot_runpod_verify_get**](DefaultApi.md#verify_runpod_api_v1_skypilot_runpod_verify_get) | **GET** /api/v1/skypilot/runpod/verify | Verify Runpod


# **add_node_api_v1_clusters_cluster_name_nodes_post**
> object add_node_api_v1_clusters_cluster_name_nodes_post(cluster_name, ip, user, password=password, identity_file=identity_file, identity_file_path=identity_file_path, vcpus=vcpus, memory_gb=memory_gb)

Add Node

### Example

* Bearer Authentication (HTTPBearer):

```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    cluster_name = 'cluster_name_example' # str | 
    ip = 'ip_example' # str | 
    user = 'user_example' # str | 
    password = 'password_example' # str |  (optional)
    identity_file = None # bytearray |  (optional)
    identity_file_path = 'identity_file_path_example' # str |  (optional)
    vcpus = 'vcpus_example' # str |  (optional)
    memory_gb = 'memory_gb_example' # str |  (optional)

    try:
        # Add Node
        api_response = api_instance.add_node_api_v1_clusters_cluster_name_nodes_post(cluster_name, ip, user, password=password, identity_file=identity_file, identity_file_path=identity_file_path, vcpus=vcpus, memory_gb=memory_gb)
        print("The response of DefaultApi->add_node_api_v1_clusters_cluster_name_nodes_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->add_node_api_v1_clusters_cluster_name_nodes_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **cluster_name** | **str**|  | 
 **ip** | **str**|  | 
 **user** | **str**|  | 
 **password** | **str**|  | [optional] 
 **identity_file** | **bytearray**|  | [optional] 
 **identity_file_path** | **str**|  | [optional] 
 **vcpus** | **str**|  | [optional] 
 **memory_gb** | **str**|  | [optional] 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: multipart/form-data
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **add_organization_member_api_v1_admin_orgs_organization_id_members_post**
> object add_organization_member_api_v1_admin_orgs_organization_id_members_post(organization_id, add_member_request)

Add Organization Member

Add a member to an organization with specified role (admin endpoint)

### Example


```python
import openapi_client
from openapi_client.models.add_member_request import AddMemberRequest
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    organization_id = 'organization_id_example' # str | 
    add_member_request = openapi_client.AddMemberRequest() # AddMemberRequest | 

    try:
        # Add Organization Member
        api_response = api_instance.add_organization_member_api_v1_admin_orgs_organization_id_members_post(organization_id, add_member_request)
        print("The response of DefaultApi->add_organization_member_api_v1_admin_orgs_organization_id_members_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->add_organization_member_api_v1_admin_orgs_organization_id_members_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **organization_id** | **str**|  | 
 **add_member_request** | [**AddMemberRequest**](AddMemberRequest.md)|  | 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **auth_callback_api_v1_auth_callback_get**
> object auth_callback_api_v1_auth_callback_get(code)

Auth Callback

### Example


```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    code = 'code_example' # str | 

    try:
        # Auth Callback
        api_response = api_instance.auth_callback_api_v1_auth_callback_get(code)
        print("The response of DefaultApi->auth_callback_api_v1_auth_callback_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->auth_callback_api_v1_auth_callback_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **code** | **str**|  | 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **cancel_cluster_job_api_v1_skypilot_jobs_cluster_name_job_id_cancel_post**
> object cancel_cluster_job_api_v1_skypilot_jobs_cluster_name_job_id_cancel_post(cluster_name, job_id)

Cancel Cluster Job

Cancel a job on a SkyPilot cluster.

### Example

* Bearer Authentication (HTTPBearer):

```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    cluster_name = 'cluster_name_example' # str | 
    job_id = 56 # int | 

    try:
        # Cancel Cluster Job
        api_response = api_instance.cancel_cluster_job_api_v1_skypilot_jobs_cluster_name_job_id_cancel_post(cluster_name, job_id)
        print("The response of DefaultApi->cancel_cluster_job_api_v1_skypilot_jobs_cluster_name_job_id_cancel_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->cancel_cluster_job_api_v1_skypilot_jobs_cluster_name_job_id_cancel_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **cluster_name** | **str**|  | 
 **job_id** | **int**|  | 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **check_auth_api_v1_auth_check_get**
> object check_auth_api_v1_auth_check_get()

Check Auth

### Example


```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)

    try:
        # Check Auth
        api_response = api_instance.check_auth_api_v1_auth_check_get()
        print("The response of DefaultApi->check_auth_api_v1_auth_check_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->check_auth_api_v1_auth_check_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **create_api_key_api_v1_api_keys_post**
> CreateAPIKeyResponse create_api_key_api_v1_api_keys_post(create_api_key_request)

Create Api Key

Create a new API key for the current user

### Example


```python
import openapi_client
from openapi_client.models.create_api_key_request import CreateAPIKeyRequest
from openapi_client.models.create_api_key_response import CreateAPIKeyResponse
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    create_api_key_request = openapi_client.CreateAPIKeyRequest() # CreateAPIKeyRequest | 

    try:
        # Create Api Key
        api_response = api_instance.create_api_key_api_v1_api_keys_post(create_api_key_request)
        print("The response of DefaultApi->create_api_key_api_v1_api_keys_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->create_api_key_api_v1_api_keys_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **create_api_key_request** | [**CreateAPIKeyRequest**](CreateAPIKeyRequest.md)|  | 

### Return type

[**CreateAPIKeyResponse**](CreateAPIKeyResponse.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **create_cluster_api_v1_clusters_post**
> ClusterResponse create_cluster_api_v1_clusters_post(cluster_name, user=user, password=password, identity_file=identity_file, identity_file_path=identity_file_path, vcpus=vcpus, memory_gb=memory_gb)

Create Cluster

### Example

* Bearer Authentication (HTTPBearer):

```python
import openapi_client
from openapi_client.models.cluster_response import ClusterResponse
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    cluster_name = 'cluster_name_example' # str | 
    user = 'user_example' # str |  (optional)
    password = 'password_example' # str |  (optional)
    identity_file = None # bytearray |  (optional)
    identity_file_path = 'identity_file_path_example' # str |  (optional)
    vcpus = 'vcpus_example' # str |  (optional)
    memory_gb = 'memory_gb_example' # str |  (optional)

    try:
        # Create Cluster
        api_response = api_instance.create_cluster_api_v1_clusters_post(cluster_name, user=user, password=password, identity_file=identity_file, identity_file_path=identity_file_path, vcpus=vcpus, memory_gb=memory_gb)
        print("The response of DefaultApi->create_cluster_api_v1_clusters_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->create_cluster_api_v1_clusters_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **cluster_name** | **str**|  | 
 **user** | **str**|  | [optional] 
 **password** | **str**|  | [optional] 
 **identity_file** | **bytearray**|  | [optional] 
 **identity_file_path** | **str**|  | [optional] 
 **vcpus** | **str**|  | [optional] 
 **memory_gb** | **str**|  | [optional] 

### Return type

[**ClusterResponse**](ClusterResponse.md)

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: multipart/form-data
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **create_organization_api_v1_admin_orgs_post**
> OrganizationResponse create_organization_api_v1_admin_orgs_post(create_organization_request)

Create Organization

Create a new organization (admin endpoint)

### Example


```python
import openapi_client
from openapi_client.models.create_organization_request import CreateOrganizationRequest
from openapi_client.models.organization_response import OrganizationResponse
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    create_organization_request = openapi_client.CreateOrganizationRequest() # CreateOrganizationRequest | 

    try:
        # Create Organization
        api_response = api_instance.create_organization_api_v1_admin_orgs_post(create_organization_request)
        print("The response of DefaultApi->create_organization_api_v1_admin_orgs_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->create_organization_api_v1_admin_orgs_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **create_organization_request** | [**CreateOrganizationRequest**](CreateOrganizationRequest.md)|  | 

### Return type

[**OrganizationResponse**](OrganizationResponse.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **delete_api_key_api_v1_api_keys_key_id_delete**
> object delete_api_key_api_v1_api_keys_key_id_delete(key_id)

Delete Api Key

Delete an API key

### Example


```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    key_id = 'key_id_example' # str | 

    try:
        # Delete Api Key
        api_response = api_instance.delete_api_key_api_v1_api_keys_key_id_delete(key_id)
        print("The response of DefaultApi->delete_api_key_api_v1_api_keys_key_id_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->delete_api_key_api_v1_api_keys_key_id_delete: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **key_id** | **str**|  | 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **delete_azure_config_route_api_v1_skypilot_azure_config_config_key_delete**
> object delete_azure_config_route_api_v1_skypilot_azure_config_config_key_delete(config_key)

Delete Azure Config Route

Delete an Azure configuration

### Example

* Bearer Authentication (HTTPBearer):

```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    config_key = 'config_key_example' # str | 

    try:
        # Delete Azure Config Route
        api_response = api_instance.delete_azure_config_route_api_v1_skypilot_azure_config_config_key_delete(config_key)
        print("The response of DefaultApi->delete_azure_config_route_api_v1_skypilot_azure_config_config_key_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->delete_azure_config_route_api_v1_skypilot_azure_config_config_key_delete: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **config_key** | **str**|  | 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **delete_cluster_api_v1_clusters_cluster_name_delete**
> object delete_cluster_api_v1_clusters_cluster_name_delete(cluster_name)

Delete Cluster

### Example

* Bearer Authentication (HTTPBearer):

```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    cluster_name = 'cluster_name_example' # str | 

    try:
        # Delete Cluster
        api_response = api_instance.delete_cluster_api_v1_clusters_cluster_name_delete(cluster_name)
        print("The response of DefaultApi->delete_cluster_api_v1_clusters_cluster_name_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->delete_cluster_api_v1_clusters_cluster_name_delete: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **cluster_name** | **str**|  | 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **delete_identity_file_api_v1_clusters_identity_files_file_path_delete**
> object delete_identity_file_api_v1_clusters_identity_files_file_path_delete(file_path)

Delete Identity File

### Example

* Bearer Authentication (HTTPBearer):

```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    file_path = 'file_path_example' # str | 

    try:
        # Delete Identity File
        api_response = api_instance.delete_identity_file_api_v1_clusters_identity_files_file_path_delete(file_path)
        print("The response of DefaultApi->delete_identity_file_api_v1_clusters_identity_files_file_path_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->delete_identity_file_api_v1_clusters_identity_files_file_path_delete: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **file_path** | **str**|  | 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **delete_organization_api_v1_admin_orgs_organization_id_delete**
> object delete_organization_api_v1_admin_orgs_organization_id_delete(organization_id)

Delete Organization

Delete an organization (admin endpoint)

### Example


```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    organization_id = 'organization_id_example' # str | 

    try:
        # Delete Organization
        api_response = api_instance.delete_organization_api_v1_admin_orgs_organization_id_delete(organization_id)
        print("The response of DefaultApi->delete_organization_api_v1_admin_orgs_organization_id_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->delete_organization_api_v1_admin_orgs_organization_id_delete: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **organization_id** | **str**|  | 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **delete_runpod_config_route_api_v1_skypilot_runpod_config_config_key_delete**
> object delete_runpod_config_route_api_v1_skypilot_runpod_config_config_key_delete(config_key)

Delete Runpod Config Route

Delete a RunPod configuration

### Example

* Bearer Authentication (HTTPBearer):

```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    config_key = 'config_key_example' # str | 

    try:
        # Delete Runpod Config Route
        api_response = api_instance.delete_runpod_config_route_api_v1_skypilot_runpod_config_config_key_delete(config_key)
        print("The response of DefaultApi->delete_runpod_config_route_api_v1_skypilot_runpod_config_config_key_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->delete_runpod_config_route_api_v1_skypilot_runpod_config_config_key_delete: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **config_key** | **str**|  | 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **down_skypilot_cluster_api_v1_skypilot_down_post**
> DownClusterResponse down_skypilot_cluster_api_v1_skypilot_down_post(down_cluster_request)

Down Skypilot Cluster

### Example

* Bearer Authentication (HTTPBearer):

```python
import openapi_client
from openapi_client.models.down_cluster_request import DownClusterRequest
from openapi_client.models.down_cluster_response import DownClusterResponse
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    down_cluster_request = openapi_client.DownClusterRequest() # DownClusterRequest | 

    try:
        # Down Skypilot Cluster
        api_response = api_instance.down_skypilot_cluster_api_v1_skypilot_down_post(down_cluster_request)
        print("The response of DefaultApi->down_skypilot_cluster_api_v1_skypilot_down_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->down_skypilot_cluster_api_v1_skypilot_down_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **down_cluster_request** | [**DownClusterRequest**](DownClusterRequest.md)|  | 

### Return type

[**DownClusterResponse**](DownClusterResponse.md)

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **fetch_cluster_resources_api_v1_skypilot_fetch_resources_cluster_name_get**
> object fetch_cluster_resources_api_v1_skypilot_fetch_resources_cluster_name_get(cluster_name)

Fetch Cluster Resources

For a given SSH cluster, bring it up, show GPU info, and bring it down again.
Returns GPU info under 'gpu_resources'.
Also updates ~/.sky/lattice_data/ssh_node_info.json for all nodes in the cluster.

### Example

* Bearer Authentication (HTTPBearer):

```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    cluster_name = 'cluster_name_example' # str | 

    try:
        # Fetch Cluster Resources
        api_response = api_instance.fetch_cluster_resources_api_v1_skypilot_fetch_resources_cluster_name_get(cluster_name)
        print("The response of DefaultApi->fetch_cluster_resources_api_v1_skypilot_fetch_resources_cluster_name_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->fetch_cluster_resources_api_v1_skypilot_fetch_resources_cluster_name_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **cluster_name** | **str**|  | 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **get_active_port_forwards_api_v1_skypilot_port_forwards_get**
> object get_active_port_forwards_api_v1_skypilot_port_forwards_get()

Get Active Port Forwards

Get list of active port forwards.

### Example

* Bearer Authentication (HTTPBearer):

```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)

    try:
        # Get Active Port Forwards
        api_response = api_instance.get_active_port_forwards_api_v1_skypilot_port_forwards_get()
        print("The response of DefaultApi->get_active_port_forwards_api_v1_skypilot_port_forwards_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->get_active_port_forwards_api_v1_skypilot_port_forwards_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **get_all_cluster_platforms_api_v1_skypilot_cluster_platforms_get**
> object get_all_cluster_platforms_api_v1_skypilot_cluster_platforms_get()

Get All Cluster Platforms

Get platform information for all clusters.

### Example

* Bearer Authentication (HTTPBearer):

```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)

    try:
        # Get All Cluster Platforms
        api_response = api_instance.get_all_cluster_platforms_api_v1_skypilot_cluster_platforms_get()
        print("The response of DefaultApi->get_all_cluster_platforms_api_v1_skypilot_cluster_platforms_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->get_all_cluster_platforms_api_v1_skypilot_cluster_platforms_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **get_api_key_api_v1_api_keys_key_id_get**
> APIKeyResponse get_api_key_api_v1_api_keys_key_id_get(key_id)

Get Api Key

Get a specific API key by ID

### Example


```python
import openapi_client
from openapi_client.models.api_key_response import APIKeyResponse
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    key_id = 'key_id_example' # str | 

    try:
        # Get Api Key
        api_response = api_instance.get_api_key_api_v1_api_keys_key_id_get(key_id)
        print("The response of DefaultApi->get_api_key_api_v1_api_keys_key_id_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->get_api_key_api_v1_api_keys_key_id_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **key_id** | **str**|  | 

### Return type

[**APIKeyResponse**](APIKeyResponse.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **get_availability_reports_api_v1_reports_availability_get**
> object get_availability_reports_api_v1_reports_availability_get(days=days)

Get Availability Reports

Get availability reports for the current user

### Example


```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    days = 56 # int |  (optional)

    try:
        # Get Availability Reports
        api_response = api_instance.get_availability_reports_api_v1_reports_availability_get(days=days)
        print("The response of DefaultApi->get_availability_reports_api_v1_reports_availability_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->get_availability_reports_api_v1_reports_availability_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **days** | **int**|  | [optional] 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **get_azure_config_actual_api_v1_skypilot_azure_config_actual_get**
> object get_azure_config_actual_api_v1_skypilot_azure_config_actual_get()

Get Azure Config Actual

Get current Azure configuration with actual credentials (for testing)

### Example

* Bearer Authentication (HTTPBearer):

```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)

    try:
        # Get Azure Config Actual
        api_response = api_instance.get_azure_config_actual_api_v1_skypilot_azure_config_actual_get()
        print("The response of DefaultApi->get_azure_config_actual_api_v1_skypilot_azure_config_actual_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->get_azure_config_actual_api_v1_skypilot_azure_config_actual_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **get_azure_config_api_v1_skypilot_azure_config_get**
> object get_azure_config_api_v1_skypilot_azure_config_get()

Get Azure Config

Get current Azure configuration

### Example

* Bearer Authentication (HTTPBearer):

```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)

    try:
        # Get Azure Config
        api_response = api_instance.get_azure_config_api_v1_skypilot_azure_config_get()
        print("The response of DefaultApi->get_azure_config_api_v1_skypilot_azure_config_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->get_azure_config_api_v1_skypilot_azure_config_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **get_azure_credentials_api_v1_skypilot_azure_credentials_get**
> object get_azure_credentials_api_v1_skypilot_azure_credentials_get(config_key=config_key)

Get Azure Credentials

Get Azure configuration with actual credentials (for display)

### Example

* Bearer Authentication (HTTPBearer):

```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    config_key = 'config_key_example' # str |  (optional)

    try:
        # Get Azure Credentials
        api_response = api_instance.get_azure_credentials_api_v1_skypilot_azure_credentials_get(config_key=config_key)
        print("The response of DefaultApi->get_azure_credentials_api_v1_skypilot_azure_credentials_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->get_azure_credentials_api_v1_skypilot_azure_credentials_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **config_key** | **str**|  | [optional] 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **get_azure_instance_types_route_api_v1_skypilot_azure_instance_types_get**
> object get_azure_instance_types_route_api_v1_skypilot_azure_instance_types_get()

Get Azure Instance Types Route

Get available Azure instance types

### Example

* Bearer Authentication (HTTPBearer):

```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)

    try:
        # Get Azure Instance Types Route
        api_response = api_instance.get_azure_instance_types_route_api_v1_skypilot_azure_instance_types_get()
        print("The response of DefaultApi->get_azure_instance_types_route_api_v1_skypilot_azure_instance_types_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->get_azure_instance_types_route_api_v1_skypilot_azure_instance_types_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **get_azure_instances_api_v1_skypilot_azure_instances_get**
> object get_azure_instances_api_v1_skypilot_azure_instances_get()

Get Azure Instances

Get current Azure instance count and limits

### Example

* Bearer Authentication (HTTPBearer):

```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)

    try:
        # Get Azure Instances
        api_response = api_instance.get_azure_instances_api_v1_skypilot_azure_instances_get()
        print("The response of DefaultApi->get_azure_instances_api_v1_skypilot_azure_instances_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->get_azure_instances_api_v1_skypilot_azure_instances_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **get_azure_regions_route_api_v1_skypilot_azure_regions_get**
> object get_azure_regions_route_api_v1_skypilot_azure_regions_get()

Get Azure Regions Route

Get available Azure regions

### Example

* Bearer Authentication (HTTPBearer):

```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)

    try:
        # Get Azure Regions Route
        api_response = api_instance.get_azure_regions_route_api_v1_skypilot_azure_regions_get()
        print("The response of DefaultApi->get_azure_regions_route_api_v1_skypilot_azure_regions_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->get_azure_regions_route_api_v1_skypilot_azure_regions_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **get_cluster_api_v1_clusters_cluster_name_get**
> ClusterResponse get_cluster_api_v1_clusters_cluster_name_get(cluster_name)

Get Cluster

### Example

* Bearer Authentication (HTTPBearer):

```python
import openapi_client
from openapi_client.models.cluster_response import ClusterResponse
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    cluster_name = 'cluster_name_example' # str | 

    try:
        # Get Cluster
        api_response = api_instance.get_cluster_api_v1_clusters_cluster_name_get(cluster_name)
        print("The response of DefaultApi->get_cluster_api_v1_clusters_cluster_name_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->get_cluster_api_v1_clusters_cluster_name_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **cluster_name** | **str**|  | 

### Return type

[**ClusterResponse**](ClusterResponse.md)

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **get_cluster_job_logs_api_v1_skypilot_jobs_cluster_name_job_id_logs_get**
> JobLogsResponse get_cluster_job_logs_api_v1_skypilot_jobs_cluster_name_job_id_logs_get(cluster_name, job_id, tail_lines=tail_lines)

Get Cluster Job Logs

### Example

* Bearer Authentication (HTTPBearer):

```python
import openapi_client
from openapi_client.models.job_logs_response import JobLogsResponse
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    cluster_name = 'cluster_name_example' # str | 
    job_id = 56 # int | 
    tail_lines = 50 # int |  (optional) (default to 50)

    try:
        # Get Cluster Job Logs
        api_response = api_instance.get_cluster_job_logs_api_v1_skypilot_jobs_cluster_name_job_id_logs_get(cluster_name, job_id, tail_lines=tail_lines)
        print("The response of DefaultApi->get_cluster_job_logs_api_v1_skypilot_jobs_cluster_name_job_id_logs_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->get_cluster_job_logs_api_v1_skypilot_jobs_cluster_name_job_id_logs_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **cluster_name** | **str**|  | 
 **job_id** | **int**|  | 
 **tail_lines** | **int**|  | [optional] [default to 50]

### Return type

[**JobLogsResponse**](JobLogsResponse.md)

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **get_cluster_jobs_api_v1_skypilot_jobs_cluster_name_get**
> JobQueueResponse get_cluster_jobs_api_v1_skypilot_jobs_cluster_name_get(cluster_name)

Get Cluster Jobs

### Example

* Bearer Authentication (HTTPBearer):

```python
import openapi_client
from openapi_client.models.job_queue_response import JobQueueResponse
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    cluster_name = 'cluster_name_example' # str | 

    try:
        # Get Cluster Jobs
        api_response = api_instance.get_cluster_jobs_api_v1_skypilot_jobs_cluster_name_get(cluster_name)
        print("The response of DefaultApi->get_cluster_jobs_api_v1_skypilot_jobs_cluster_name_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->get_cluster_jobs_api_v1_skypilot_jobs_cluster_name_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **cluster_name** | **str**|  | 

### Return type

[**JobQueueResponse**](JobQueueResponse.md)

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **get_cluster_platform_info_api_v1_skypilot_cluster_platform_cluster_name_get**
> object get_cluster_platform_info_api_v1_skypilot_cluster_platform_cluster_name_get(cluster_name)

Get Cluster Platform Info

Get platform information for a specific cluster.

### Example

* Bearer Authentication (HTTPBearer):

```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    cluster_name = 'cluster_name_example' # str | 

    try:
        # Get Cluster Platform Info
        api_response = api_instance.get_cluster_platform_info_api_v1_skypilot_cluster_platform_cluster_name_get(cluster_name)
        print("The response of DefaultApi->get_cluster_platform_info_api_v1_skypilot_cluster_platform_cluster_name_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->get_cluster_platform_info_api_v1_skypilot_cluster_platform_cluster_name_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **cluster_name** | **str**|  | 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **get_cluster_template_info_api_v1_skypilot_cluster_template_cluster_name_get**
> object get_cluster_template_info_api_v1_skypilot_cluster_template_cluster_name_get(cluster_name)

Get Cluster Template Info

Get template information for a specific cluster.

### Example

* Bearer Authentication (HTTPBearer):

```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    cluster_name = 'cluster_name_example' # str | 

    try:
        # Get Cluster Template Info
        api_response = api_instance.get_cluster_template_info_api_v1_skypilot_cluster_template_cluster_name_get(cluster_name)
        print("The response of DefaultApi->get_cluster_template_info_api_v1_skypilot_cluster_template_cluster_name_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->get_cluster_template_info_api_v1_skypilot_cluster_template_cluster_name_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **cluster_name** | **str**|  | 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **get_cluster_type_api_v1_skypilot_cluster_type_cluster_name_get**
> object get_cluster_type_api_v1_skypilot_cluster_type_cluster_name_get(cluster_name)

Get Cluster Type

### Example

* Bearer Authentication (HTTPBearer):

```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    cluster_name = 'cluster_name_example' # str | 

    try:
        # Get Cluster Type
        api_response = api_instance.get_cluster_type_api_v1_skypilot_cluster_type_cluster_name_get(cluster_name)
        print("The response of DefaultApi->get_cluster_type_api_v1_skypilot_cluster_type_cluster_name_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->get_cluster_type_api_v1_skypilot_cluster_type_cluster_name_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **cluster_name** | **str**|  | 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **get_cost_report_api_v1_skypilot_cost_report_get**
> object get_cost_report_api_v1_skypilot_cost_report_get()

Get Cost Report

Get cost report for all clusters.

### Example

* Bearer Authentication (HTTPBearer):

```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)

    try:
        # Get Cost Report
        api_response = api_instance.get_cost_report_api_v1_skypilot_cost_report_get()
        print("The response of DefaultApi->get_cost_report_api_v1_skypilot_cost_report_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->get_cost_report_api_v1_skypilot_cost_report_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **get_current_user_info_api_v1_auth_me_get**
> UserResponse get_current_user_info_api_v1_auth_me_get()

Get Current User Info

### Example


```python
import openapi_client
from openapi_client.models.user_response import UserResponse
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)

    try:
        # Get Current User Info
        api_response = api_instance.get_current_user_info_api_v1_auth_me_get()
        print("The response of DefaultApi->get_current_user_info_api_v1_auth_me_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->get_current_user_info_api_v1_auth_me_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

[**UserResponse**](UserResponse.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **get_job_success_reports_api_v1_reports_job_success_get**
> object get_job_success_reports_api_v1_reports_job_success_get(days=days)

Get Job Success Reports

Get job success reports for the current user

### Example


```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    days = 56 # int |  (optional)

    try:
        # Get Job Success Reports
        api_response = api_instance.get_job_success_reports_api_v1_reports_job_success_get(days=days)
        print("The response of DefaultApi->get_job_success_reports_api_v1_reports_job_success_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->get_job_success_reports_api_v1_reports_job_success_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **days** | **int**|  | [optional] 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **get_login_url_api_v1_auth_login_url_get**
> object get_login_url_api_v1_auth_login_url_get()

Get Login Url

### Example


```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)

    try:
        # Get Login Url
        api_response = api_instance.get_login_url_api_v1_auth_login_url_get()
        print("The response of DefaultApi->get_login_url_api_v1_auth_login_url_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->get_login_url_api_v1_auth_login_url_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **get_node_pools_api_v1_node_pools_get**
> object get_node_pools_api_v1_node_pools_get()

Get Node Pools

Get comprehensive node pools data combining:
- Clusters from /clusters endpoint
- RunPod instances from /skypilot/runpod/instances
- Azure instances from /skypilot/azure/instances
- SSH node info from /skypilot/ssh-node-info
- SkyPilot status from /skypilot/status

### Example

* Bearer Authentication (HTTPBearer):

```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)

    try:
        # Get Node Pools
        api_response = api_instance.get_node_pools_api_v1_node_pools_get()
        print("The response of DefaultApi->get_node_pools_api_v1_node_pools_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->get_node_pools_api_v1_node_pools_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **get_organization_api_v1_admin_orgs_organization_id_get**
> OrganizationResponse get_organization_api_v1_admin_orgs_organization_id_get(organization_id)

Get Organization

Get a specific organization by ID (admin endpoint)

### Example


```python
import openapi_client
from openapi_client.models.organization_response import OrganizationResponse
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    organization_id = 'organization_id_example' # str | 

    try:
        # Get Organization
        api_response = api_instance.get_organization_api_v1_admin_orgs_organization_id_get(organization_id)
        print("The response of DefaultApi->get_organization_api_v1_admin_orgs_organization_id_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->get_organization_api_v1_admin_orgs_organization_id_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **organization_id** | **str**|  | 

### Return type

[**OrganizationResponse**](OrganizationResponse.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **get_past_job_logs_api_v1_skypilot_past_jobs_cluster_name_job_id_logs_get**
> object get_past_job_logs_api_v1_skypilot_past_jobs_cluster_name_job_id_logs_get(cluster_name, job_id)

Get Past Job Logs

Get logs for a past job.

### Example

* Bearer Authentication (HTTPBearer):

```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    cluster_name = 'cluster_name_example' # str | 
    job_id = 56 # int | 

    try:
        # Get Past Job Logs
        api_response = api_instance.get_past_job_logs_api_v1_skypilot_past_jobs_cluster_name_job_id_logs_get(cluster_name, job_id)
        print("The response of DefaultApi->get_past_job_logs_api_v1_skypilot_past_jobs_cluster_name_job_id_logs_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->get_past_job_logs_api_v1_skypilot_past_jobs_cluster_name_job_id_logs_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **cluster_name** | **str**|  | 
 **job_id** | **int**|  | 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **get_past_jobs_endpoint_api_v1_skypilot_past_jobs_get**
> object get_past_jobs_endpoint_api_v1_skypilot_past_jobs_get()

Get Past Jobs Endpoint

Get all past jobs from saved files.

### Example

* Bearer Authentication (HTTPBearer):

```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)

    try:
        # Get Past Jobs Endpoint
        api_response = api_instance.get_past_jobs_endpoint_api_v1_skypilot_past_jobs_get()
        print("The response of DefaultApi->get_past_jobs_endpoint_api_v1_skypilot_past_jobs_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->get_past_jobs_endpoint_api_v1_skypilot_past_jobs_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **get_runpod_config_api_v1_skypilot_runpod_config_get**
> object get_runpod_config_api_v1_skypilot_runpod_config_get()

Get Runpod Config

Get current RunPod configuration

### Example

* Bearer Authentication (HTTPBearer):

```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)

    try:
        # Get Runpod Config
        api_response = api_instance.get_runpod_config_api_v1_skypilot_runpod_config_get()
        print("The response of DefaultApi->get_runpod_config_api_v1_skypilot_runpod_config_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->get_runpod_config_api_v1_skypilot_runpod_config_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **get_runpod_display_options_route_api_v1_skypilot_runpod_display_options_get**
> object get_runpod_display_options_route_api_v1_skypilot_runpod_display_options_get()

Get Runpod Display Options Route

Get available RunPod options with user-friendly display names

### Example

* Bearer Authentication (HTTPBearer):

```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)

    try:
        # Get Runpod Display Options Route
        api_response = api_instance.get_runpod_display_options_route_api_v1_skypilot_runpod_display_options_get()
        print("The response of DefaultApi->get_runpod_display_options_route_api_v1_skypilot_runpod_display_options_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->get_runpod_display_options_route_api_v1_skypilot_runpod_display_options_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **get_runpod_display_options_with_pricing_route_api_v1_skypilot_runpod_display_options_with_pricing_get**
> object get_runpod_display_options_with_pricing_route_api_v1_skypilot_runpod_display_options_with_pricing_get()

Get Runpod Display Options With Pricing Route

Get available RunPod options with user-friendly display names and pricing information.

### Example

* Bearer Authentication (HTTPBearer):

```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)

    try:
        # Get Runpod Display Options With Pricing Route
        api_response = api_instance.get_runpod_display_options_with_pricing_route_api_v1_skypilot_runpod_display_options_with_pricing_get()
        print("The response of DefaultApi->get_runpod_display_options_with_pricing_route_api_v1_skypilot_runpod_display_options_with_pricing_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->get_runpod_display_options_with_pricing_route_api_v1_skypilot_runpod_display_options_with_pricing_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **get_runpod_gpu_types_route_api_v1_skypilot_runpod_gpu_types_get**
> object get_runpod_gpu_types_route_api_v1_skypilot_runpod_gpu_types_get()

Get Runpod Gpu Types Route

Get available GPU types from RunPod with pricing information

### Example

* Bearer Authentication (HTTPBearer):

```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)

    try:
        # Get Runpod Gpu Types Route
        api_response = api_instance.get_runpod_gpu_types_route_api_v1_skypilot_runpod_gpu_types_get()
        print("The response of DefaultApi->get_runpod_gpu_types_route_api_v1_skypilot_runpod_gpu_types_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->get_runpod_gpu_types_route_api_v1_skypilot_runpod_gpu_types_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **get_runpod_gpu_types_with_pricing_route_api_v1_skypilot_runpod_gpu_types_with_pricing_get**
> object get_runpod_gpu_types_with_pricing_route_api_v1_skypilot_runpod_gpu_types_with_pricing_get()

Get Runpod Gpu Types With Pricing Route

Get available GPU types from RunPod with detailed pricing information.

### Example

* Bearer Authentication (HTTPBearer):

```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)

    try:
        # Get Runpod Gpu Types With Pricing Route
        api_response = api_instance.get_runpod_gpu_types_with_pricing_route_api_v1_skypilot_runpod_gpu_types_with_pricing_get()
        print("The response of DefaultApi->get_runpod_gpu_types_with_pricing_route_api_v1_skypilot_runpod_gpu_types_with_pricing_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->get_runpod_gpu_types_with_pricing_route_api_v1_skypilot_runpod_gpu_types_with_pricing_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **get_runpod_instances_api_v1_skypilot_runpod_instances_get**
> object get_runpod_instances_api_v1_skypilot_runpod_instances_get()

Get Runpod Instances

Get current RunPod instance count and limits

### Example

* Bearer Authentication (HTTPBearer):

```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)

    try:
        # Get Runpod Instances
        api_response = api_instance.get_runpod_instances_api_v1_skypilot_runpod_instances_get()
        print("The response of DefaultApi->get_runpod_instances_api_v1_skypilot_runpod_instances_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->get_runpod_instances_api_v1_skypilot_runpod_instances_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **get_skypilot_cluster_status_api_v1_skypilot_status_get**
> StatusResponse get_skypilot_cluster_status_api_v1_skypilot_status_get(cluster_names=cluster_names)

Get Skypilot Cluster Status

### Example

* Bearer Authentication (HTTPBearer):

```python
import openapi_client
from openapi_client.models.status_response import StatusResponse
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    cluster_names = 'cluster_names_example' # str |  (optional)

    try:
        # Get Skypilot Cluster Status
        api_response = api_instance.get_skypilot_cluster_status_api_v1_skypilot_status_get(cluster_names=cluster_names)
        print("The response of DefaultApi->get_skypilot_cluster_status_api_v1_skypilot_status_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->get_skypilot_cluster_status_api_v1_skypilot_status_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **cluster_names** | **str**|  | [optional] 

### Return type

[**StatusResponse**](StatusResponse.md)

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **get_skypilot_request_status_api_v1_skypilot_request_request_id_get**
> object get_skypilot_request_status_api_v1_skypilot_request_request_id_get(request_id)

Get Skypilot Request Status

### Example

* Bearer Authentication (HTTPBearer):

```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    request_id = 'request_id_example' # str | 

    try:
        # Get Skypilot Request Status
        api_response = api_instance.get_skypilot_request_status_api_v1_skypilot_request_request_id_get(request_id)
        print("The response of DefaultApi->get_skypilot_request_status_api_v1_skypilot_request_request_id_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->get_skypilot_request_status_api_v1_skypilot_request_request_id_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **request_id** | **str**|  | 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **get_ssh_node_info_api_v1_skypilot_ssh_node_info_get**
> object get_ssh_node_info_api_v1_skypilot_ssh_node_info_get()

Get Ssh Node Info

### Example

* Bearer Authentication (HTTPBearer):

```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)

    try:
        # Get Ssh Node Info
        api_response = api_instance.get_ssh_node_info_api_v1_skypilot_ssh_node_info_get()
        print("The response of DefaultApi->get_ssh_node_info_api_v1_skypilot_ssh_node_info_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->get_ssh_node_info_api_v1_skypilot_ssh_node_info_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **get_usage_reports_api_v1_reports_usage_get**
> object get_usage_reports_api_v1_reports_usage_get(days=days)

Get Usage Reports

Get usage reports for the current user

### Example


```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    days = 56 # int |  (optional)

    try:
        # Get Usage Reports
        api_response = api_instance.get_usage_reports_api_v1_reports_usage_get(days=days)
        print("The response of DefaultApi->get_usage_reports_api_v1_reports_usage_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->get_usage_reports_api_v1_reports_usage_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **days** | **int**|  | [optional] 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **get_user_reports_api_v1_reports_get**
> ReportsResponse get_user_reports_api_v1_reports_get(days=days)

Get User Reports

Get all reports for the current user

### Example


```python
import openapi_client
from openapi_client.models.reports_response import ReportsResponse
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    days = 56 # int |  (optional)

    try:
        # Get User Reports
        api_response = api_instance.get_user_reports_api_v1_reports_get(days=days)
        print("The response of DefaultApi->get_user_reports_api_v1_reports_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->get_user_reports_api_v1_reports_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **days** | **int**|  | [optional] 

### Return type

[**ReportsResponse**](ReportsResponse.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **get_vscode_tunnel_info_endpoint_api_v1_skypilot_jobs_cluster_name_job_id_vscode_info_get**
> object get_vscode_tunnel_info_endpoint_api_v1_skypilot_jobs_cluster_name_job_id_vscode_info_get(cluster_name, job_id)

Get Vscode Tunnel Info Endpoint

Get VSCode tunnel information from job logs.

### Example

* Bearer Authentication (HTTPBearer):

```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    cluster_name = 'cluster_name_example' # str | 
    job_id = 56 # int | 

    try:
        # Get Vscode Tunnel Info Endpoint
        api_response = api_instance.get_vscode_tunnel_info_endpoint_api_v1_skypilot_jobs_cluster_name_job_id_vscode_info_get(cluster_name, job_id)
        print("The response of DefaultApi->get_vscode_tunnel_info_endpoint_api_v1_skypilot_jobs_cluster_name_job_id_vscode_info_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->get_vscode_tunnel_info_endpoint_api_v1_skypilot_jobs_cluster_name_job_id_vscode_info_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **cluster_name** | **str**|  | 
 **job_id** | **int**|  | 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **launch_skypilot_cluster_api_v1_skypilot_launch_post**
> LaunchClusterResponse launch_skypilot_cluster_api_v1_skypilot_launch_post(cluster_name, command=command, setup=setup, cloud=cloud, instance_type=instance_type, cpus=cpus, memory=memory, accelerators=accelerators, region=region, zone=zone, use_spot=use_spot, idle_minutes_to_autostop=idle_minutes_to_autostop, python_file=python_file, launch_mode=launch_mode, jupyter_port=jupyter_port, vscode_port=vscode_port, template=template)

Launch Skypilot Cluster

### Example

* Bearer Authentication (HTTPBearer):

```python
import openapi_client
from openapi_client.models.launch_cluster_response import LaunchClusterResponse
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    cluster_name = 'cluster_name_example' # str | 
    command = 'echo \'Hello SkyPilot\'' # str |  (optional) (default to 'echo \'Hello SkyPilot\'')
    setup = 'setup_example' # str |  (optional)
    cloud = 'cloud_example' # str |  (optional)
    instance_type = 'instance_type_example' # str |  (optional)
    cpus = 'cpus_example' # str |  (optional)
    memory = 'memory_example' # str |  (optional)
    accelerators = 'accelerators_example' # str |  (optional)
    region = 'region_example' # str |  (optional)
    zone = 'zone_example' # str |  (optional)
    use_spot = False # bool |  (optional) (default to False)
    idle_minutes_to_autostop = 56 # int |  (optional)
    python_file = None # bytearray |  (optional)
    launch_mode = 'launch_mode_example' # str |  (optional)
    jupyter_port = 56 # int |  (optional)
    vscode_port = 56 # int |  (optional)
    template = 'template_example' # str |  (optional)

    try:
        # Launch Skypilot Cluster
        api_response = api_instance.launch_skypilot_cluster_api_v1_skypilot_launch_post(cluster_name, command=command, setup=setup, cloud=cloud, instance_type=instance_type, cpus=cpus, memory=memory, accelerators=accelerators, region=region, zone=zone, use_spot=use_spot, idle_minutes_to_autostop=idle_minutes_to_autostop, python_file=python_file, launch_mode=launch_mode, jupyter_port=jupyter_port, vscode_port=vscode_port, template=template)
        print("The response of DefaultApi->launch_skypilot_cluster_api_v1_skypilot_launch_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->launch_skypilot_cluster_api_v1_skypilot_launch_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **cluster_name** | **str**|  | 
 **command** | **str**|  | [optional] [default to &#39;echo \&#39;Hello SkyPilot\&#39;&#39;]
 **setup** | **str**|  | [optional] 
 **cloud** | **str**|  | [optional] 
 **instance_type** | **str**|  | [optional] 
 **cpus** | **str**|  | [optional] 
 **memory** | **str**|  | [optional] 
 **accelerators** | **str**|  | [optional] 
 **region** | **str**|  | [optional] 
 **zone** | **str**|  | [optional] 
 **use_spot** | **bool**|  | [optional] [default to False]
 **idle_minutes_to_autostop** | **int**|  | [optional] 
 **python_file** | **bytearray**|  | [optional] 
 **launch_mode** | **str**|  | [optional] 
 **jupyter_port** | **int**|  | [optional] 
 **vscode_port** | **int**|  | [optional] 
 **template** | **str**|  | [optional] 

### Return type

[**LaunchClusterResponse**](LaunchClusterResponse.md)

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: multipart/form-data
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **list_all_organizations_api_v1_admin_orgs_get**
> OrganizationsResponse list_all_organizations_api_v1_admin_orgs_get()

List All Organizations

Get organizations that the current user is a member of (admin endpoint)

### Example


```python
import openapi_client
from openapi_client.models.organizations_response import OrganizationsResponse
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)

    try:
        # List All Organizations
        api_response = api_instance.list_all_organizations_api_v1_admin_orgs_get()
        print("The response of DefaultApi->list_all_organizations_api_v1_admin_orgs_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->list_all_organizations_api_v1_admin_orgs_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

[**OrganizationsResponse**](OrganizationsResponse.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **list_api_keys_api_v1_api_keys_get**
> List[APIKeyResponse] list_api_keys_api_v1_api_keys_get()

List Api Keys

List all API keys for the current user

### Example


```python
import openapi_client
from openapi_client.models.api_key_response import APIKeyResponse
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)

    try:
        # List Api Keys
        api_response = api_instance.list_api_keys_api_v1_api_keys_get()
        print("The response of DefaultApi->list_api_keys_api_v1_api_keys_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->list_api_keys_api_v1_api_keys_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

[**List[APIKeyResponse]**](APIKeyResponse.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **list_clusters_api_v1_clusters_get**
> ClustersListResponse list_clusters_api_v1_clusters_get()

List Clusters

### Example

* Bearer Authentication (HTTPBearer):

```python
import openapi_client
from openapi_client.models.clusters_list_response import ClustersListResponse
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)

    try:
        # List Clusters
        api_response = api_instance.list_clusters_api_v1_clusters_get()
        print("The response of DefaultApi->list_clusters_api_v1_clusters_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->list_clusters_api_v1_clusters_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

[**ClustersListResponse**](ClustersListResponse.md)

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **list_identity_files_api_v1_clusters_identity_files_get**
> object list_identity_files_api_v1_clusters_identity_files_get()

List Identity Files

### Example

* Bearer Authentication (HTTPBearer):

```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)

    try:
        # List Identity Files
        api_response = api_instance.list_identity_files_api_v1_clusters_identity_files_get()
        print("The response of DefaultApi->list_identity_files_api_v1_clusters_identity_files_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->list_identity_files_api_v1_clusters_identity_files_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **list_node_pools_api_v1_skypilot_node_pools_get**
> object list_node_pools_api_v1_skypilot_node_pools_get()

List Node Pools

Get all node pools (Azure, RunPod, and SSH clusters)

### Example

* Bearer Authentication (HTTPBearer):

```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)

    try:
        # List Node Pools
        api_response = api_instance.list_node_pools_api_v1_skypilot_node_pools_get()
        print("The response of DefaultApi->list_node_pools_api_v1_skypilot_node_pools_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->list_node_pools_api_v1_skypilot_node_pools_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **list_organization_members_api_v1_admin_orgs_organization_id_members_get**
> object list_organization_members_api_v1_admin_orgs_organization_id_members_get(organization_id)

List Organization Members

List all members of an organization (admin endpoint)

### Example


```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    organization_id = 'organization_id_example' # str | 

    try:
        # List Organization Members
        api_response = api_instance.list_organization_members_api_v1_admin_orgs_organization_id_members_get(organization_id)
        print("The response of DefaultApi->list_organization_members_api_v1_admin_orgs_organization_id_members_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->list_organization_members_api_v1_admin_orgs_organization_id_members_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **organization_id** | **str**|  | 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **list_ssh_clusters_api_v1_skypilot_ssh_clusters_get**
> object list_ssh_clusters_api_v1_skypilot_ssh_clusters_get()

List Ssh Clusters

### Example

* Bearer Authentication (HTTPBearer):

```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)

    try:
        # List Ssh Clusters
        api_response = api_instance.list_ssh_clusters_api_v1_skypilot_ssh_clusters_get()
        print("The response of DefaultApi->list_ssh_clusters_api_v1_skypilot_ssh_clusters_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->list_ssh_clusters_api_v1_skypilot_ssh_clusters_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **logout_api_v1_auth_logout_get**
> object logout_api_v1_auth_logout_get()

Logout

### Example


```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)

    try:
        # Logout
        api_response = api_instance.logout_api_v1_auth_logout_get()
        print("The response of DefaultApi->logout_api_v1_auth_logout_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->logout_api_v1_auth_logout_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **refresh_session_api_v1_auth_refresh_post**
> object refresh_session_api_v1_auth_refresh_post()

Refresh Session

Force refresh the WorkOS session to get updated user info

### Example


```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)

    try:
        # Refresh Session
        api_response = api_instance.refresh_session_api_v1_auth_refresh_post()
        print("The response of DefaultApi->refresh_session_api_v1_auth_refresh_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->refresh_session_api_v1_auth_refresh_post: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **regenerate_api_key_api_v1_api_keys_key_id_regenerate_post**
> CreateAPIKeyResponse regenerate_api_key_api_v1_api_keys_key_id_regenerate_post(key_id)

Regenerate Api Key

Regenerate an API key (creates a new key value but keeps the same record)

### Example


```python
import openapi_client
from openapi_client.models.create_api_key_response import CreateAPIKeyResponse
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    key_id = 'key_id_example' # str | 

    try:
        # Regenerate Api Key
        api_response = api_instance.regenerate_api_key_api_v1_api_keys_key_id_regenerate_post(key_id)
        print("The response of DefaultApi->regenerate_api_key_api_v1_api_keys_key_id_regenerate_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->regenerate_api_key_api_v1_api_keys_key_id_regenerate_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **key_id** | **str**|  | 

### Return type

[**CreateAPIKeyResponse**](CreateAPIKeyResponse.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **remove_node_api_v1_clusters_cluster_name_nodes_node_ip_delete**
> object remove_node_api_v1_clusters_cluster_name_nodes_node_ip_delete(cluster_name, node_ip)

Remove Node

### Example

* Bearer Authentication (HTTPBearer):

```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    cluster_name = 'cluster_name_example' # str | 
    node_ip = 'node_ip_example' # str | 

    try:
        # Remove Node
        api_response = api_instance.remove_node_api_v1_clusters_cluster_name_nodes_node_ip_delete(cluster_name, node_ip)
        print("The response of DefaultApi->remove_node_api_v1_clusters_cluster_name_nodes_node_ip_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->remove_node_api_v1_clusters_cluster_name_nodes_node_ip_delete: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **cluster_name** | **str**|  | 
 **node_ip** | **str**|  | 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **remove_organization_member_api_v1_admin_orgs_organization_id_members_user_id_delete**
> object remove_organization_member_api_v1_admin_orgs_organization_id_members_user_id_delete(organization_id, user_id)

Remove Organization Member

Remove a member from an organization (admin endpoint)

### Example


```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    organization_id = 'organization_id_example' # str | 
    user_id = 'user_id_example' # str | 

    try:
        # Remove Organization Member
        api_response = api_instance.remove_organization_member_api_v1_admin_orgs_organization_id_members_user_id_delete(organization_id, user_id)
        print("The response of DefaultApi->remove_organization_member_api_v1_admin_orgs_organization_id_members_user_id_delete:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->remove_organization_member_api_v1_admin_orgs_organization_id_members_user_id_delete: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **organization_id** | **str**|  | 
 **user_id** | **str**|  | 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **rename_identity_file_route_api_v1_clusters_identity_files_file_path_put**
> object rename_identity_file_route_api_v1_clusters_identity_files_file_path_put(file_path, new_display_name)

Rename Identity File Route

### Example

* Bearer Authentication (HTTPBearer):

```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    file_path = 'file_path_example' # str | 
    new_display_name = 'new_display_name_example' # str | 

    try:
        # Rename Identity File Route
        api_response = api_instance.rename_identity_file_route_api_v1_clusters_identity_files_file_path_put(file_path, new_display_name)
        print("The response of DefaultApi->rename_identity_file_route_api_v1_clusters_identity_files_file_path_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->rename_identity_file_route_api_v1_clusters_identity_files_file_path_put: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **file_path** | **str**|  | 
 **new_display_name** | **str**|  | 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/x-www-form-urlencoded
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **run_sky_check_azure_route_api_v1_skypilot_azure_sky_check_get**
> object run_sky_check_azure_route_api_v1_skypilot_azure_sky_check_get()

Run Sky Check Azure Route

Run 'sky check azure' to validate the Azure setup

### Example

* Bearer Authentication (HTTPBearer):

```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)

    try:
        # Run Sky Check Azure Route
        api_response = api_instance.run_sky_check_azure_route_api_v1_skypilot_azure_sky_check_get()
        print("The response of DefaultApi->run_sky_check_azure_route_api_v1_skypilot_azure_sky_check_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->run_sky_check_azure_route_api_v1_skypilot_azure_sky_check_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **run_sky_check_runpod_route_api_v1_skypilot_runpod_sky_check_get**
> object run_sky_check_runpod_route_api_v1_skypilot_runpod_sky_check_get()

Run Sky Check Runpod Route

Run 'sky check runpod' to validate the RunPod setup

### Example

* Bearer Authentication (HTTPBearer):

```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)

    try:
        # Run Sky Check Runpod Route
        api_response = api_instance.run_sky_check_runpod_route_api_v1_skypilot_runpod_sky_check_get()
        print("The response of DefaultApi->run_sky_check_runpod_route_api_v1_skypilot_runpod_sky_check_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->run_sky_check_runpod_route_api_v1_skypilot_runpod_sky_check_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **save_azure_config_route_api_v1_skypilot_azure_config_post**
> object save_azure_config_route_api_v1_skypilot_azure_config_post(azure_config_request)

Save Azure Config Route

Save Azure configuration

### Example

* Bearer Authentication (HTTPBearer):

```python
import openapi_client
from openapi_client.models.azure_config_request import AzureConfigRequest
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    azure_config_request = openapi_client.AzureConfigRequest() # AzureConfigRequest | 

    try:
        # Save Azure Config Route
        api_response = api_instance.save_azure_config_route_api_v1_skypilot_azure_config_post(azure_config_request)
        print("The response of DefaultApi->save_azure_config_route_api_v1_skypilot_azure_config_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->save_azure_config_route_api_v1_skypilot_azure_config_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **azure_config_request** | [**AzureConfigRequest**](AzureConfigRequest.md)|  | 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **save_runpod_config_route_api_v1_skypilot_runpod_config_post**
> object save_runpod_config_route_api_v1_skypilot_runpod_config_post(run_pod_config_request)

Save Runpod Config Route

Save RunPod configuration

### Example

* Bearer Authentication (HTTPBearer):

```python
import openapi_client
from openapi_client.models.run_pod_config_request import RunPodConfigRequest
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    run_pod_config_request = openapi_client.RunPodConfigRequest() # RunPodConfigRequest | 

    try:
        # Save Runpod Config Route
        api_response = api_instance.save_runpod_config_route_api_v1_skypilot_runpod_config_post(run_pod_config_request)
        print("The response of DefaultApi->save_runpod_config_route_api_v1_skypilot_runpod_config_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->save_runpod_config_route_api_v1_skypilot_runpod_config_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **run_pod_config_request** | [**RunPodConfigRequest**](RunPodConfigRequest.md)|  | 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **send_organization_invitation_api_v1_admin_orgs_organization_id_invitations_post**
> object send_organization_invitation_api_v1_admin_orgs_organization_id_invitations_post(organization_id, send_invitation_request)

Send Organization Invitation

Send an invitation to a user to join an organization (admin endpoint)

### Example


```python
import openapi_client
from openapi_client.models.send_invitation_request import SendInvitationRequest
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    organization_id = 'organization_id_example' # str | 
    send_invitation_request = openapi_client.SendInvitationRequest() # SendInvitationRequest | 

    try:
        # Send Organization Invitation
        api_response = api_instance.send_organization_invitation_api_v1_admin_orgs_organization_id_invitations_post(organization_id, send_invitation_request)
        print("The response of DefaultApi->send_organization_invitation_api_v1_admin_orgs_organization_id_invitations_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->send_organization_invitation_api_v1_admin_orgs_organization_id_invitations_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **organization_id** | **str**|  | 
 **send_invitation_request** | [**SendInvitationRequest**](SendInvitationRequest.md)|  | 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **serve_frontend_path_get**
> object serve_frontend_path_get(path)

Serve Frontend

### Example


```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    path = 'path_example' # str | 

    try:
        # Serve Frontend
        api_response = api_instance.serve_frontend_path_get(path)
        print("The response of DefaultApi->serve_frontend_path_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->serve_frontend_path_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **path** | **str**|  | 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **set_azure_default_config_route_api_v1_skypilot_azure_config_config_key_set_default_post**
> object set_azure_default_config_route_api_v1_skypilot_azure_config_config_key_set_default_post(config_key)

Set Azure Default Config Route

Set a specific Azure config as default

### Example

* Bearer Authentication (HTTPBearer):

```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    config_key = 'config_key_example' # str | 

    try:
        # Set Azure Default Config Route
        api_response = api_instance.set_azure_default_config_route_api_v1_skypilot_azure_config_config_key_set_default_post(config_key)
        print("The response of DefaultApi->set_azure_default_config_route_api_v1_skypilot_azure_config_config_key_set_default_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->set_azure_default_config_route_api_v1_skypilot_azure_config_config_key_set_default_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **config_key** | **str**|  | 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **set_runpod_default_config_route_api_v1_skypilot_runpod_config_config_key_set_default_post**
> object set_runpod_default_config_route_api_v1_skypilot_runpod_config_config_key_set_default_post(config_key)

Set Runpod Default Config Route

Set a specific RunPod config as default

### Example

* Bearer Authentication (HTTPBearer):

```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    config_key = 'config_key_example' # str | 

    try:
        # Set Runpod Default Config Route
        api_response = api_instance.set_runpod_default_config_route_api_v1_skypilot_runpod_config_config_key_set_default_post(config_key)
        print("The response of DefaultApi->set_runpod_default_config_route_api_v1_skypilot_runpod_config_config_key_set_default_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->set_runpod_default_config_route_api_v1_skypilot_runpod_config_config_key_set_default_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **config_key** | **str**|  | 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **setup_azure_api_v1_skypilot_azure_setup_get**
> object setup_azure_api_v1_skypilot_azure_setup_get()

Setup Azure

Setup Azure configuration

### Example

* Bearer Authentication (HTTPBearer):

```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)

    try:
        # Setup Azure
        api_response = api_instance.setup_azure_api_v1_skypilot_azure_setup_get()
        print("The response of DefaultApi->setup_azure_api_v1_skypilot_azure_setup_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->setup_azure_api_v1_skypilot_azure_setup_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **setup_job_port_forward_api_v1_skypilot_jobs_cluster_name_job_id_setup_port_forward_post**
> object setup_job_port_forward_api_v1_skypilot_jobs_cluster_name_job_id_setup_port_forward_post(cluster_name, job_id, job_type, jupyter_port=jupyter_port, vscode_port=vscode_port)

Setup Job Port Forward

Setup port forwarding for a specific job (typically called when job starts running).

### Example

* Bearer Authentication (HTTPBearer):

```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    cluster_name = 'cluster_name_example' # str | 
    job_id = 56 # int | 
    job_type = 'job_type_example' # str | 
    jupyter_port = 56 # int |  (optional)
    vscode_port = 56 # int |  (optional)

    try:
        # Setup Job Port Forward
        api_response = api_instance.setup_job_port_forward_api_v1_skypilot_jobs_cluster_name_job_id_setup_port_forward_post(cluster_name, job_id, job_type, jupyter_port=jupyter_port, vscode_port=vscode_port)
        print("The response of DefaultApi->setup_job_port_forward_api_v1_skypilot_jobs_cluster_name_job_id_setup_port_forward_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->setup_job_port_forward_api_v1_skypilot_jobs_cluster_name_job_id_setup_port_forward_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **cluster_name** | **str**|  | 
 **job_id** | **int**|  | 
 **job_type** | **str**|  | 
 **jupyter_port** | **int**|  | [optional] 
 **vscode_port** | **int**|  | [optional] 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/x-www-form-urlencoded
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **setup_runpod_api_v1_skypilot_runpod_setup_get**
> object setup_runpod_api_v1_skypilot_runpod_setup_get()

Setup Runpod

Setup RunPod configuration

### Example

* Bearer Authentication (HTTPBearer):

```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)

    try:
        # Setup Runpod
        api_response = api_instance.setup_runpod_api_v1_skypilot_runpod_setup_get()
        print("The response of DefaultApi->setup_runpod_api_v1_skypilot_runpod_setup_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->setup_runpod_api_v1_skypilot_runpod_setup_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **start_web_ssh_session_api_v1_skypilot_ssh_session_cluster_name_get**
> object start_web_ssh_session_api_v1_skypilot_ssh_session_cluster_name_get(cluster_name)

Start Web Ssh Session

Start web SSH session using Wetty for this cluster.
This runs Wetty on this server and connects to the cluster via SSH.
Skypilot sets it up so that 'ssh <cluster_name>' connects to the right cluster.

### Example

* Bearer Authentication (HTTPBearer):

```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    cluster_name = 'cluster_name_example' # str | 

    try:
        # Start Web Ssh Session
        api_response = api_instance.start_web_ssh_session_api_v1_skypilot_ssh_session_cluster_name_get(cluster_name)
        print("The response of DefaultApi->start_web_ssh_session_api_v1_skypilot_ssh_session_cluster_name_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->start_web_ssh_session_api_v1_skypilot_ssh_session_cluster_name_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **cluster_name** | **str**|  | 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **stop_port_forward_api_v1_skypilot_port_forwards_cluster_name_stop_post**
> object stop_port_forward_api_v1_skypilot_port_forwards_cluster_name_stop_post(cluster_name)

Stop Port Forward

Stop port forwarding for a specific cluster.

### Example

* Bearer Authentication (HTTPBearer):

```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    cluster_name = 'cluster_name_example' # str | 

    try:
        # Stop Port Forward
        api_response = api_instance.stop_port_forward_api_v1_skypilot_port_forwards_cluster_name_stop_post(cluster_name)
        print("The response of DefaultApi->stop_port_forward_api_v1_skypilot_port_forwards_cluster_name_stop_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->stop_port_forward_api_v1_skypilot_port_forwards_cluster_name_stop_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **cluster_name** | **str**|  | 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **stop_skypilot_cluster_api_v1_skypilot_stop_post**
> StopClusterResponse stop_skypilot_cluster_api_v1_skypilot_stop_post(stop_cluster_request)

Stop Skypilot Cluster

### Example

* Bearer Authentication (HTTPBearer):

```python
import openapi_client
from openapi_client.models.stop_cluster_request import StopClusterRequest
from openapi_client.models.stop_cluster_response import StopClusterResponse
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    stop_cluster_request = openapi_client.StopClusterRequest() # StopClusterRequest | 

    try:
        # Stop Skypilot Cluster
        api_response = api_instance.stop_skypilot_cluster_api_v1_skypilot_stop_post(stop_cluster_request)
        print("The response of DefaultApi->stop_skypilot_cluster_api_v1_skypilot_stop_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->stop_skypilot_cluster_api_v1_skypilot_stop_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **stop_cluster_request** | [**StopClusterRequest**](StopClusterRequest.md)|  | 

### Return type

[**StopClusterResponse**](StopClusterResponse.md)

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **stream_skypilot_logs_api_v1_skypilot_stream_logs_logfile_get**
> object stream_skypilot_logs_api_v1_skypilot_stream_logs_logfile_get(logfile)

Stream Skypilot Logs

### Example

* Bearer Authentication (HTTPBearer):

```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    logfile = 'logfile_example' # str | 

    try:
        # Stream Skypilot Logs
        api_response = api_instance.stream_skypilot_logs_api_v1_skypilot_stream_logs_logfile_get(logfile)
        print("The response of DefaultApi->stream_skypilot_logs_api_v1_skypilot_stream_logs_logfile_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->stream_skypilot_logs_api_v1_skypilot_stream_logs_logfile_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **logfile** | **str**|  | 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **submit_job_to_cluster_api_v1_skypilot_jobs_cluster_name_submit_post**
> object submit_job_to_cluster_api_v1_skypilot_jobs_cluster_name_submit_post(cluster_name, command, setup=setup, cpus=cpus, memory=memory, accelerators=accelerators, region=region, zone=zone, job_name=job_name, python_file=python_file, job_type=job_type, jupyter_port=jupyter_port, vscode_port=vscode_port)

Submit Job To Cluster

### Example

* Bearer Authentication (HTTPBearer):

```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    cluster_name = 'cluster_name_example' # str | 
    command = 'command_example' # str | 
    setup = 'setup_example' # str |  (optional)
    cpus = 'cpus_example' # str |  (optional)
    memory = 'memory_example' # str |  (optional)
    accelerators = 'accelerators_example' # str |  (optional)
    region = 'region_example' # str |  (optional)
    zone = 'zone_example' # str |  (optional)
    job_name = 'job_name_example' # str |  (optional)
    python_file = None # bytearray |  (optional)
    job_type = 'job_type_example' # str |  (optional)
    jupyter_port = 56 # int |  (optional)
    vscode_port = 56 # int |  (optional)

    try:
        # Submit Job To Cluster
        api_response = api_instance.submit_job_to_cluster_api_v1_skypilot_jobs_cluster_name_submit_post(cluster_name, command, setup=setup, cpus=cpus, memory=memory, accelerators=accelerators, region=region, zone=zone, job_name=job_name, python_file=python_file, job_type=job_type, jupyter_port=jupyter_port, vscode_port=vscode_port)
        print("The response of DefaultApi->submit_job_to_cluster_api_v1_skypilot_jobs_cluster_name_submit_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->submit_job_to_cluster_api_v1_skypilot_jobs_cluster_name_submit_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **cluster_name** | **str**|  | 
 **command** | **str**|  | 
 **setup** | **str**|  | [optional] 
 **cpus** | **str**|  | [optional] 
 **memory** | **str**|  | [optional] 
 **accelerators** | **str**|  | [optional] 
 **region** | **str**|  | [optional] 
 **zone** | **str**|  | [optional] 
 **job_name** | **str**|  | [optional] 
 **python_file** | **bytearray**|  | [optional] 
 **job_type** | **str**|  | [optional] 
 **jupyter_port** | **int**|  | [optional] 
 **vscode_port** | **int**|  | [optional] 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: multipart/form-data
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **terminal_connect_api_v1_terminal_get**
> str terminal_connect_api_v1_terminal_get(cluster_name)

Terminal Connect

### Example

* Bearer Authentication (HTTPBearer):

```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    cluster_name = 'cluster_name_example' # str | 

    try:
        # Terminal Connect
        api_response = api_instance.terminal_connect_api_v1_terminal_get(cluster_name)
        print("The response of DefaultApi->terminal_connect_api_v1_terminal_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->terminal_connect_api_v1_terminal_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **cluster_name** | **str**|  | 

### Return type

**str**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: text/html, application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **test_azure_connection_route_api_v1_skypilot_azure_test_post**
> object test_azure_connection_route_api_v1_skypilot_azure_test_post(azure_test_request)

Test Azure Connection Route

Test Azure API connection

### Example

* Bearer Authentication (HTTPBearer):

```python
import openapi_client
from openapi_client.models.azure_test_request import AzureTestRequest
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    azure_test_request = openapi_client.AzureTestRequest() # AzureTestRequest | 

    try:
        # Test Azure Connection Route
        api_response = api_instance.test_azure_connection_route_api_v1_skypilot_azure_test_post(azure_test_request)
        print("The response of DefaultApi->test_azure_connection_route_api_v1_skypilot_azure_test_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->test_azure_connection_route_api_v1_skypilot_azure_test_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **azure_test_request** | [**AzureTestRequest**](AzureTestRequest.md)|  | 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **test_runpod_connection_route_api_v1_skypilot_runpod_test_post**
> object test_runpod_connection_route_api_v1_skypilot_runpod_test_post(run_pod_test_request)

Test Runpod Connection Route

Test RunPod API connection

### Example

* Bearer Authentication (HTTPBearer):

```python
import openapi_client
from openapi_client.models.run_pod_test_request import RunPodTestRequest
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    run_pod_test_request = openapi_client.RunPodTestRequest() # RunPodTestRequest | 

    try:
        # Test Runpod Connection Route
        api_response = api_instance.test_runpod_connection_route_api_v1_skypilot_runpod_test_post(run_pod_test_request)
        print("The response of DefaultApi->test_runpod_connection_route_api_v1_skypilot_runpod_test_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->test_runpod_connection_route_api_v1_skypilot_runpod_test_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **run_pod_test_request** | [**RunPodTestRequest**](RunPodTestRequest.md)|  | 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **update_api_key_api_v1_api_keys_key_id_put**
> APIKeyResponse update_api_key_api_v1_api_keys_key_id_put(key_id, update_api_key_request)

Update Api Key

Update an API key

### Example


```python
import openapi_client
from openapi_client.models.api_key_response import APIKeyResponse
from openapi_client.models.update_api_key_request import UpdateAPIKeyRequest
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    key_id = 'key_id_example' # str | 
    update_api_key_request = openapi_client.UpdateAPIKeyRequest() # UpdateAPIKeyRequest | 

    try:
        # Update Api Key
        api_response = api_instance.update_api_key_api_v1_api_keys_key_id_put(key_id, update_api_key_request)
        print("The response of DefaultApi->update_api_key_api_v1_api_keys_key_id_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->update_api_key_api_v1_api_keys_key_id_put: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **key_id** | **str**|  | 
 **update_api_key_request** | [**UpdateAPIKeyRequest**](UpdateAPIKeyRequest.md)|  | 

### Return type

[**APIKeyResponse**](APIKeyResponse.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **update_member_role_api_v1_admin_orgs_organization_id_members_user_id_role_put**
> object update_member_role_api_v1_admin_orgs_organization_id_members_user_id_role_put(organization_id, user_id, update_member_role_request)

Update Member Role

Update a member's role in an organization (admin endpoint)

### Example


```python
import openapi_client
from openapi_client.models.update_member_role_request import UpdateMemberRoleRequest
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)


# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    organization_id = 'organization_id_example' # str | 
    user_id = 'user_id_example' # str | 
    update_member_role_request = openapi_client.UpdateMemberRoleRequest() # UpdateMemberRoleRequest | 

    try:
        # Update Member Role
        api_response = api_instance.update_member_role_api_v1_admin_orgs_organization_id_members_user_id_role_put(organization_id, user_id, update_member_role_request)
        print("The response of DefaultApi->update_member_role_api_v1_admin_orgs_organization_id_members_user_id_role_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->update_member_role_api_v1_admin_orgs_organization_id_members_user_id_role_put: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **organization_id** | **str**|  | 
 **user_id** | **str**|  | 
 **update_member_role_request** | [**UpdateMemberRoleRequest**](UpdateMemberRoleRequest.md)|  | 

### Return type

**object**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **upload_identity_file_api_v1_clusters_identity_files_post**
> object upload_identity_file_api_v1_clusters_identity_files_post(display_name, identity_file)

Upload Identity File

### Example

* Bearer Authentication (HTTPBearer):

```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)
    display_name = 'display_name_example' # str | 
    identity_file = None # bytearray | 

    try:
        # Upload Identity File
        api_response = api_instance.upload_identity_file_api_v1_clusters_identity_files_post(display_name, identity_file)
        print("The response of DefaultApi->upload_identity_file_api_v1_clusters_identity_files_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->upload_identity_file_api_v1_clusters_identity_files_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **display_name** | **str**|  | 
 **identity_file** | **bytearray**|  | 

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: application/x-www-form-urlencoded
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **verify_azure_api_v1_skypilot_azure_verify_get**
> object verify_azure_api_v1_skypilot_azure_verify_get()

Verify Azure

Verify Azure setup

### Example

* Bearer Authentication (HTTPBearer):

```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)

    try:
        # Verify Azure
        api_response = api_instance.verify_azure_api_v1_skypilot_azure_verify_get()
        print("The response of DefaultApi->verify_azure_api_v1_skypilot_azure_verify_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->verify_azure_api_v1_skypilot_azure_verify_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **verify_runpod_api_v1_skypilot_runpod_verify_get**
> object verify_runpod_api_v1_skypilot_runpod_verify_get()

Verify Runpod

Verify RunPod setup

### Example

* Bearer Authentication (HTTPBearer):

```python
import openapi_client
from openapi_client.rest import ApiException
from pprint import pprint

# Defining the host is optional and defaults to http://localhost
# See configuration.py for a list of all supported configuration parameters.
configuration = openapi_client.Configuration(
    host = "http://localhost"
)

# The client must configure the authentication and authorization parameters
# in accordance with the API server security policy.
# Examples for each auth method are provided below, use the example that
# satisfies your auth use case.

# Configure Bearer authorization: HTTPBearer
configuration = openapi_client.Configuration(
    access_token = os.environ["BEARER_TOKEN"]
)

# Enter a context with an instance of the API client
with openapi_client.ApiClient(configuration) as api_client:
    # Create an instance of the API class
    api_instance = openapi_client.DefaultApi(api_client)

    try:
        # Verify Runpod
        api_response = api_instance.verify_runpod_api_v1_skypilot_runpod_verify_get()
        print("The response of DefaultApi->verify_runpod_api_v1_skypilot_runpod_verify_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling DefaultApi->verify_runpod_api_v1_skypilot_runpod_verify_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

**object**

### Authorization

[HTTPBearer](../README.md#HTTPBearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

