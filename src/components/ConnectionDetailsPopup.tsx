/*
   Copyright 2026 Shko Online LLC <sales@shko.online>

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
 */

import { useEffect } from 'react';
import { Badge, Button, Text } from '@fluentui/react-components';
import { CheckmarkCircle24Regular, Dismiss24Regular, Warning24Regular } from '@fluentui/react-icons';
import EllipsisText from './EllipsisText';
import getEnvironmentColor from '../utils/getEnvironmentColor';
import useConnectionDetailsPopupStyles from './ConnectionDetailsPopup.styles';

export interface ConnectionDetailsPopupProps {
    connection: ToolBoxAPI.DataverseConnection | null;
    onClose: () => void;
}

export function ConnectionDetailsPopup({ connection, onClose }: ConnectionDetailsPopupProps) {
    const styles = useConnectionDetailsPopupStyles();

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onClose]);

    const fields: Array<[string, string]> = connection
        ? [
              ['Name', connection.name],
              ['URL', connection.url],
              ['ID', connection.id],
          ]
        : [];

    return (
        <div className={styles.overlay} role="presentation" onMouseDown={onClose}>
            <section
                className={styles.popup}
                role="dialog"
                aria-modal="true"
                aria-labelledby="connection-details-title"
                onMouseDown={(event) => event.stopPropagation()}
            >
                <div className={styles.header}>
                    <div className={styles.title}>
                        {connection ? <CheckmarkCircle24Regular className={styles.connectedIcon} /> : <Warning24Regular className={styles.warningIcon} />}
                        <Text id="connection-details-title" weight="semibold" size={400}>
                            Connection details
                        </Text>
                    </div>
                    <Button appearance="subtle" icon={<Dismiss24Regular />} aria-label="Close connection details" onClick={onClose} autoFocus />
                </div>
                <div className={styles.body}>
                    {connection ? (
                        <table className={styles.fields}>
                            <tbody>
                                {fields.slice(0, 2).map(([name, value]) => (
                                    <tr key={name}>
                                        <th className={styles.fieldName} scope="row">{name}</th>
                                        <td className={styles.fieldValue} title={value}>{value}</td>
                                    </tr>
                                ))}
                                <tr>
                                    <th className={styles.fieldName} scope="row">Environment</th>
                                    <td className={styles.fieldValue}>
                                        <Badge appearance="filled" color={getEnvironmentColor(connection.environment)} className={styles.environmentBadge}>
                                            <EllipsisText className={styles.ellipsis} value={connection.environment} />
                                        </Badge>
                                    </td>
                                </tr>
                                {fields.slice(2).map(([name, value]) => (
                                    <tr key={name}>
                                        <th className={styles.fieldName} scope="row">{name}</th>
                                        <td className={styles.fieldValue} title={value}>{value}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className={styles.warningBox}>
                            <Warning24Regular />
                            <div>
                                <Text weight="semibold">No active connection</Text>
                                <br />
                                <Text>Please connect to a Dataverse environment to use this tool.</Text>
                            </div>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}
