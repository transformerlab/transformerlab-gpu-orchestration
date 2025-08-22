# openapi_client.SSHKeysApi

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**create_ssh_key_api_v1_ssh_keys_post**](SSHKeysApi.md#create_ssh_key_api_v1_ssh_keys_post) | **POST** /api/v1/ssh-keys/ | Create Ssh Key
[**delete_ssh_key_api_v1_ssh_keys_key_id_delete**](SSHKeysApi.md#delete_ssh_key_api_v1_ssh_keys_key_id_delete) | **DELETE** /api/v1/ssh-keys/{key_id} | Delete Ssh Key
[**get_ssh_key_api_v1_ssh_keys_key_id_get**](SSHKeysApi.md#get_ssh_key_api_v1_ssh_keys_key_id_get) | **GET** /api/v1/ssh-keys/{key_id} | Get Ssh Key
[**list_ssh_keys_api_v1_ssh_keys_get**](SSHKeysApi.md#list_ssh_keys_api_v1_ssh_keys_get) | **GET** /api/v1/ssh-keys/ | List Ssh Keys
[**lookup_user_by_ssh_key_api_v1_ssh_keys_lookup_by_key_get**](SSHKeysApi.md#lookup_user_by_ssh_key_api_v1_ssh_keys_lookup_by_key_get) | **GET** /api/v1/ssh-keys/lookup/by-key | Lookup User By Ssh Key
[**update_ssh_key_api_v1_ssh_keys_key_id_put**](SSHKeysApi.md#update_ssh_key_api_v1_ssh_keys_key_id_put) | **PUT** /api/v1/ssh-keys/{key_id} | Update Ssh Key


# **create_ssh_key_api_v1_ssh_keys_post**
> SSHKeyResponse create_ssh_key_api_v1_ssh_keys_post(create_ssh_key_request)

Create Ssh Key

Create a new SSH public key for the current user.

### Example


```python
import openapi_client
from openapi_client.models.create_ssh_key_request import CreateSSHKeyRequest
from openapi_client.models.ssh_key_response import SSHKeyResponse
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
    api_instance = openapi_client.SSHKeysApi(api_client)
    create_ssh_key_request = openapi_client.CreateSSHKeyRequest() # CreateSSHKeyRequest | 

    try:
        # Create Ssh Key
        api_response = api_instance.create_ssh_key_api_v1_ssh_keys_post(create_ssh_key_request)
        print("The response of SSHKeysApi->create_ssh_key_api_v1_ssh_keys_post:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SSHKeysApi->create_ssh_key_api_v1_ssh_keys_post: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **create_ssh_key_request** | [**CreateSSHKeyRequest**](CreateSSHKeyRequest.md)|  | 

### Return type

[**SSHKeyResponse**](SSHKeyResponse.md)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**201** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **delete_ssh_key_api_v1_ssh_keys_key_id_delete**
> delete_ssh_key_api_v1_ssh_keys_key_id_delete(key_id)

Delete Ssh Key

Delete an SSH key.

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
    api_instance = openapi_client.SSHKeysApi(api_client)
    key_id = 'key_id_example' # str | 

    try:
        # Delete Ssh Key
        api_instance.delete_ssh_key_api_v1_ssh_keys_key_id_delete(key_id)
    except Exception as e:
        print("Exception when calling SSHKeysApi->delete_ssh_key_api_v1_ssh_keys_key_id_delete: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **key_id** | **str**|  | 

### Return type

void (empty response body)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

### HTTP response details

| Status code | Description | Response headers |
|-------------|-------------|------------------|
**204** | Successful Response |  -  |
**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **get_ssh_key_api_v1_ssh_keys_key_id_get**
> SSHKeyResponse get_ssh_key_api_v1_ssh_keys_key_id_get(key_id)

Get Ssh Key

Get a specific SSH key by ID.

### Example


```python
import openapi_client
from openapi_client.models.ssh_key_response import SSHKeyResponse
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
    api_instance = openapi_client.SSHKeysApi(api_client)
    key_id = 'key_id_example' # str | 

    try:
        # Get Ssh Key
        api_response = api_instance.get_ssh_key_api_v1_ssh_keys_key_id_get(key_id)
        print("The response of SSHKeysApi->get_ssh_key_api_v1_ssh_keys_key_id_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SSHKeysApi->get_ssh_key_api_v1_ssh_keys_key_id_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **key_id** | **str**|  | 

### Return type

[**SSHKeyResponse**](SSHKeyResponse.md)

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

# **list_ssh_keys_api_v1_ssh_keys_get**
> SSHKeyListResponse list_ssh_keys_api_v1_ssh_keys_get()

List Ssh Keys

List all SSH keys for the current user.

### Example


```python
import openapi_client
from openapi_client.models.ssh_key_list_response import SSHKeyListResponse
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
    api_instance = openapi_client.SSHKeysApi(api_client)

    try:
        # List Ssh Keys
        api_response = api_instance.list_ssh_keys_api_v1_ssh_keys_get()
        print("The response of SSHKeysApi->list_ssh_keys_api_v1_ssh_keys_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SSHKeysApi->list_ssh_keys_api_v1_ssh_keys_get: %s\n" % e)
```



### Parameters

This endpoint does not need any parameter.

### Return type

[**SSHKeyListResponse**](SSHKeyListResponse.md)

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

# **lookup_user_by_ssh_key_api_v1_ssh_keys_lookup_by_key_get**
> Dict[str, object] lookup_user_by_ssh_key_api_v1_ssh_keys_lookup_by_key_get(public_key)

Lookup User By Ssh Key

Internal endpoint for SSH proxy server to lookup user by SSH public key.
This endpoint is intended for use by the SSH proxy server only.

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
    api_instance = openapi_client.SSHKeysApi(api_client)
    public_key = 'public_key_example' # str | 

    try:
        # Lookup User By Ssh Key
        api_response = api_instance.lookup_user_by_ssh_key_api_v1_ssh_keys_lookup_by_key_get(public_key)
        print("The response of SSHKeysApi->lookup_user_by_ssh_key_api_v1_ssh_keys_lookup_by_key_get:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SSHKeysApi->lookup_user_by_ssh_key_api_v1_ssh_keys_lookup_by_key_get: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **public_key** | **str**|  | 

### Return type

**Dict[str, object]**

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

# **update_ssh_key_api_v1_ssh_keys_key_id_put**
> SSHKeyResponse update_ssh_key_api_v1_ssh_keys_key_id_put(key_id, update_ssh_key_request)

Update Ssh Key

Update an SSH key.

### Example


```python
import openapi_client
from openapi_client.models.ssh_key_response import SSHKeyResponse
from openapi_client.models.update_ssh_key_request import UpdateSSHKeyRequest
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
    api_instance = openapi_client.SSHKeysApi(api_client)
    key_id = 'key_id_example' # str | 
    update_ssh_key_request = openapi_client.UpdateSSHKeyRequest() # UpdateSSHKeyRequest | 

    try:
        # Update Ssh Key
        api_response = api_instance.update_ssh_key_api_v1_ssh_keys_key_id_put(key_id, update_ssh_key_request)
        print("The response of SSHKeysApi->update_ssh_key_api_v1_ssh_keys_key_id_put:\n")
        pprint(api_response)
    except Exception as e:
        print("Exception when calling SSHKeysApi->update_ssh_key_api_v1_ssh_keys_key_id_put: %s\n" % e)
```



### Parameters


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **key_id** | **str**|  | 
 **update_ssh_key_request** | [**UpdateSSHKeyRequest**](UpdateSSHKeyRequest.md)|  | 

### Return type

[**SSHKeyResponse**](SSHKeyResponse.md)

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

