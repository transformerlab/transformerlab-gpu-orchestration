# OrganizationsResponse


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**organizations** | [**List[Organization]**](Organization.md) |  | 
**current_organization_id** | **str** |  | [optional] 

## Example

```python
from openapi_client.models.organizations_response import OrganizationsResponse

# TODO update the JSON string below
json = "{}"
# create an instance of OrganizationsResponse from a JSON string
organizations_response_instance = OrganizationsResponse.from_json(json)
# print the JSON string representation of the object
print(OrganizationsResponse.to_json())

# convert the object into a dict
organizations_response_dict = organizations_response_instance.to_dict()
# create an instance of OrganizationsResponse from a dict
organizations_response_from_dict = OrganizationsResponse.from_dict(organizations_response_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


