# Role Hierarchy Auth/Org Tables Reference

الغرض من الملف: مرجع سريع للأسماء المعتمدة التي نستخدمها في مناقشات وتنفيذ شغل
`RoleHierarchyComponent` والـ SQL المرتبط بها.

## Approved Tables (Fully Qualified)

1. `UADMIN_USER.UA_ROLE_MASTER`
2. `UADMIN_USER.UA_ROLE_PRIVILEGE`
3. `UADMIN_USER.UA_USER_ROLE_PRIVILEGE`
4. `UADMIN_USER.UA_FUNCTION`
5. `GPA_USER.ORG_UNIT_TYPES`
6. `GPA_USER.ORG_UNITS`
7. `GPA_USER.USER_POSITIONS`
8. `GPA_USER.VW_ORG_UNITS_WITH_COUNT`
9. `GPA_USER.VW_COMMUNICATION_USERS`

## Notes

- هذا الملف مرجعي فقط ولا يغيّر أي API/DTO/Route أو سلوك تشغيل.
- أي تعديل مستقبلي على القائمة يتم بنفس الصياغة لضمان ثبات المرجع.
